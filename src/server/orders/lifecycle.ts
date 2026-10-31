import "server-only";

import { randomBytes } from "node:crypto";

import { revalidateTag } from "next/cache";

import type { OrderStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";
import type { LocationCode } from "@/lib/catalog/product-input";
import type { CheckoutInput } from "@/lib/checkout/checkout-input";
import { canTransition } from "@/lib/checkout/order-status";
import { allowedPaymentMethods, paymentStatusFor } from "@/lib/checkout/payment-rules";
import { matchDeliveryLocation } from "@/lib/checkout/postal";
import { computeQuote, type Quote } from "@/lib/checkout/pricing";
import type { CartLineView } from "@/server/cart";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { db } from "@/server/db";
import { sendOrderEmail } from "@/server/email/order-emails";
import { createCheckoutSession, refundPaymentIntent } from "@/server/payments/stripe";
import { getSettings, stripeEnabled } from "@/server/settings";

import { loadOrder, type OrderView } from "./view";

// Every change to an order goes through this file, so stock reservations,
// payments, status and the order timeline always move together.
//
// These run from server actions, the Stripe webhook and the cron route, so
// stock changes use revalidateTag (updateTag only works in server actions).
const refreshStock = () => revalidateTag(CATALOG_TAG, "max");

type Tx = Prisma.TransactionClient;

class OutOfStockError extends Error {
  constructor(readonly productIds: string[]) {
    super("Out of stock");
  }
}

// Reserve stock only if enough is free: a single guarded UPDATE, so two
// customers can never both take the last unit.
async function reserve(tx: Tx, productId: string, locationId: string, quantity: number) {
  const updated = await tx.$executeRaw`
    UPDATE "Inventory" SET reserved = reserved + ${quantity}
    WHERE "productId" = ${productId} AND "locationId" = ${locationId}
      AND "onHand" - reserved >= ${quantity}`;
  return updated === 1;
}

async function release(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: true },
  });
  for (const line of order.lines) {
    await tx.$executeRaw`
      UPDATE "Inventory" SET reserved = GREATEST(reserved - ${line.quantity}, 0)
      WHERE "productId" = ${line.productId} AND "locationId" = ${order.locationId}`;
  }
}

function event(tx: Tx, orderId: string, type: string, message?: string, actorId?: string | null) {
  return tx.orderEvent.create({ data: { orderId, type, message, actorId: actorId ?? null } });
}

// ─── Quoting ────────────────────────────────────────────────────────────────

export type FulfilmentChoice =
  { kind: "PICKUP"; locationCode: LocationCode } | { kind: "DELIVERY"; postalCode: string };

export async function listLocations() {
  return db.location.findMany({ where: { active: true }, orderBy: { code: "desc" } });
}

export type CheckoutQuote = {
  location: Awaited<ReturnType<typeof listLocations>>[number];
  quote: Quote;
  methods: PaymentMethod[];
  // Lines without enough free stock at this location.
  shortages: string[];
};

export async function quoteCheckout(
  lines: CartLineView[],
  choice: FulfilmentChoice,
): Promise<CheckoutQuote | { error: "noDelivery" }> {
  const locations = await listLocations();
  const location =
    choice.kind === "PICKUP"
      ? locations.find((l) => l.code === choice.locationCode)
      : matchDeliveryLocation(choice.postalCode, locations);
  if (!location) return { error: "noDelivery" };

  const [rate, settings] = await Promise.all([
    db.taxRate.findUnique({ where: { province: location.province } }),
    getSettings(),
  ]);
  // Deliveries are local, so the location's province is where goods change hands.
  const quote = computeQuote(
    lines,
    choice.kind === "DELIVERY" ? location.deliveryFeeCents : 0,
    rate,
  );
  const methods = allowedPaymentMethods(quote.totalCents, {
    ...settings,
    cardEnabled: stripeEnabled(),
  });
  const shortages = lines
    .filter((line) => line.available[location.code] < line.quantity)
    .map((line) => line.productId);
  return { location, quote, methods, shortages };
}

// ─── Placing orders ─────────────────────────────────────────────────────────

export type PlaceOrderResult =
  | { ok: true; order: OrderView; redirectTo: string }
  | {
      ok: false;
      error: "empty" | "noDelivery" | "method" | "stock" | "payment";
      productIds?: string[];
    };

export async function placeOrder(
  input: CheckoutInput,
  lines: CartLineView[],
  locale: "en" | "fr",
): Promise<PlaceOrderResult> {
  if (lines.length === 0) return { ok: false, error: "empty" };
  const quoted = await quoteCheckout(
    lines,
    input.fulfilment === "PICKUP"
      ? { kind: "PICKUP", locationCode: input.locationCode! }
      : { kind: "DELIVERY", postalCode: input.address!.postalCode },
  );
  if ("error" in quoted) return { ok: false, error: "noDelivery" };
  const { location, quote, methods } = quoted;
  if (!methods.includes(input.method)) return { ok: false, error: "method" };

  const settings = await getSettings();
  const now = Date.now();
  const holdUntil = new Date(
    now +
      (input.method === "CARD"
        ? settings.cardHoldMinutes * 60_000
        : input.method === "ETRANSFER"
          ? settings.etransferHoldHours * 3_600_000
          : settings.cashHoldDays * 86_400_000),
  );

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      const short: string[] = [];
      for (const line of lines) {
        if (!(await reserve(tx, line.productId, location.id, line.quantity)))
          short.push(line.productId);
      }
      if (short.length) throw new OutOfStockError(short);

      const order = await tx.order.create({
        data: {
          accessToken: randomBytes(24).toString("base64url"),
          locale,
          name: input.name,
          email: input.email,
          phone: input.phone,
          fulfilment: input.fulfilment,
          locationId: location.id,
          deliveryAddress: input.address
            ? { ...input.address, province: location.province }
            : undefined,
          requestedWindow: input.window,
          notes: input.notes || null,
          paymentMethod: input.method,
          subtotalCents: quote.subtotalCents,
          deliveryCents: quote.deliveryCents,
          taxCents: quote.taxCents,
          totalCents: quote.totalCents,
          taxBreakdown: quote.taxes,
          holdUntil,
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              sku: line.sku,
              name: line.name,
              unitPriceCents: line.unitPriceCents,
              quantity: line.quantity,
            })),
          },
        },
      });
      await event(tx, order.id, "placed", `${input.method} · ${location.code}`);
      return order.id;
    });
  } catch (error) {
    if (error instanceof OutOfStockError)
      return { ok: false, error: "stock", productIds: error.productIds };
    throw error;
  }

  // Reserved stock changes what the storefront shows as available.
  refreshStock();
  const order = (await loadOrder(orderId))!;

  if (input.method === "CARD") {
    try {
      const session = await createCheckoutSession(order, holdUntil);
      await db.payment.create({
        data: {
          orderId,
          method: "CARD",
          amountCents: order.totalCents,
          stripeSessionId: session.id,
        },
      });
      return { ok: true, order, redirectTo: session.url! };
    } catch (error) {
      console.error("[checkout] Stripe session failed", error);
      await cancelOrder(orderId, { reason: "Card payment could not be started", notify: false });
      return { ok: false, error: "payment" };
    }
  }

  await sendOrderEmail(order, "received");
  return { ok: true, order, redirectTo: `/${locale}/orders/${order.id}?t=${order.accessToken}` };
}

// ─── Payments ───────────────────────────────────────────────────────────────

export type RecordPaymentInput = {
  method: PaymentMethod;
  amountCents: number;
  reference?: string | null;
  actorId?: string | null;
  stripeSessionId?: string;
  stripePaymentIntentId?: string | null;
};

// Records money received. Orders waiting for payment become CONFIRMED once
// fully paid (or once the deposit is in, for assembled builds).
export async function recordPayment(orderId: string, payment: RecordPaymentInput) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === "CANCELLED") return { order, changed: false };

    if (payment.stripeSessionId) {
      const existing = await tx.payment.findUnique({
        where: { stripeSessionId: payment.stripeSessionId },
      });
      if (existing?.status === "SUCCEEDED") return { order, changed: false };
      await tx.payment.upsert({
        where: { stripeSessionId: payment.stripeSessionId },
        create: {
          orderId,
          method: "CARD",
          amountCents: payment.amountCents,
          status: "SUCCEEDED",
          stripeSessionId: payment.stripeSessionId,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          receivedAt: new Date(),
        },
        update: {
          status: "SUCCEEDED",
          amountCents: payment.amountCents,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          receivedAt: new Date(),
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId,
          method: payment.method,
          amountCents: payment.amountCents,
          status: "SUCCEEDED",
          reference: payment.reference ?? null,
          recordedById: payment.actorId ?? null,
          receivedAt: new Date(),
        },
      });
    }

    const paidCents = order.paidCents + payment.amountCents;
    const paymentStatus = paymentStatusFor(paidCents, order.totalCents);
    const enoughToConfirm =
      paymentStatus === "PAID" || (order.depositCents > 0 && paidCents >= order.depositCents);
    const confirm = order.status === "PLACED" && enoughToConfirm;
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paidCents,
        paymentStatus,
        ...(confirm ? { status: "CONFIRMED" as const } : {}),
        // Paid (or deposit received): no longer at risk of expiring.
        ...(enoughToConfirm ? { holdUntil: null } : {}),
      },
    });
    await event(
      tx,
      orderId,
      "paid",
      `${payment.method} ${(payment.amountCents / 100).toFixed(2)}${payment.reference ? ` · ${payment.reference}` : ""}`,
      payment.actorId,
    );
    if (confirm) await event(tx, orderId, "status:CONFIRMED", undefined, payment.actorId);
    return { order: updated, changed: true };
  });

  if (result.changed) await sendOrderEmail((await loadOrder(orderId))!, "paid");
  return result;
}

// ─── Status changes ─────────────────────────────────────────────────────────

export async function changeStatus(
  orderId: string,
  to: Exclude<OrderStatus, "CANCELLED">,
  actorId?: string | null,
) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true },
    });
    const check = canTransition(order, to);
    if (!check.ok) throw new Error(check.reason);

    if (to === "COMPLETED") {
      // The goods have left: turn the reservation into a real stock deduction.
      for (const line of order.lines) {
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "onHand" = "onHand" - ${line.quantity}, reserved = GREATEST(reserved - ${line.quantity}, 0)
          WHERE "productId" = ${line.productId} AND "locationId" = ${order.locationId}`;
        await tx.inventoryMovement.create({
          data: {
            productId: line.productId,
            locationId: order.locationId,
            delta: -line.quantity,
            reason: "SALE",
            note: `Order ${order.number}`,
            actorId: actorId ?? null,
          },
        });
      }
    }
    // Confirming by hand (e.g. a cash order after a phone call) keeps the
    // reservation until pickup instead of letting it expire.
    await tx.order.update({
      where: { id: orderId },
      data: { status: to, ...(to === "CONFIRMED" ? { holdUntil: null } : {}) },
    });
    await event(tx, orderId, `status:${to}`, undefined, actorId);
  });

  if (to === "COMPLETED") refreshStock();
  if (to === "READY") await sendOrderEmail((await loadOrder(orderId))!, "ready");
}

// ─── Cancelling ─────────────────────────────────────────────────────────────

export async function cancelOrder(
  orderId: string,
  options: { reason: string; actorId?: string | null; notify?: boolean },
) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true },
  });
  if (order.status === "CANCELLED" || order.status === "COMPLETED") return { cancelled: false };

  // Refund card payments first, so we never cancel without returning money.
  let refundedCents = 0;
  for (const payment of order.payments) {
    if (
      payment.method === "CARD" &&
      payment.status === "SUCCEEDED" &&
      payment.stripePaymentIntentId
    ) {
      await refundPaymentIntent(payment.stripePaymentIntentId, payment.amountCents, orderId);
      refundedCents += payment.amountCents;
    }
  }

  await db.$transaction(async (tx) => {
    await release(tx, orderId);
    await tx.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (refundedCents) {
      await tx.payment.updateMany({
        where: { orderId, method: "CARD", status: "SUCCEEDED" },
        data: { status: "REFUNDED" },
      });
    }
    // Cash and e-Transfer refunds happen outside the system; the admin
    // records them (Phase 5), so those payments stay as they are here.
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelReason: options.reason,
        holdUntil: null,
        ...(refundedCents
          ? {
              paidCents: { decrement: refundedCents },
              paymentStatus: order.paidCents === refundedCents ? "REFUNDED" : order.paymentStatus,
            }
          : {}),
      },
    });
    await event(tx, orderId, "cancelled", options.reason, options.actorId);
    if (refundedCents)
      await event(
        tx,
        orderId,
        "refunded",
        `CARD ${(refundedCents / 100).toFixed(2)}`,
        options.actorId,
      );
  });

  refreshStock();
  if (options.notify !== false) {
    await sendOrderEmail((await loadOrder(orderId))!, "cancelled", { refundedCents });
  }
  return { cancelled: true, refundedCents };
}

// Cancels unpaid orders whose hold has run out. Run by the cron route and
// also when Stripe reports an expired Checkout session.
export async function expireOrders(now = new Date()) {
  const due = await db.order.findMany({
    where: { status: "PLACED", paymentStatus: "UNPAID", holdUntil: { lt: now } },
    select: { id: true },
  });
  for (const { id } of due) {
    await cancelOrder(id, { reason: "Not paid in time" });
  }
  return due.length;
}
