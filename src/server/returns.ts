import "server-only";

import { revalidateTag } from "next/cache";

import type { PaymentMethod, ReturnCondition, ReturnReason } from "@/generated/prisma/enums";
import {
  estimateRestockingFee,
  validateReturn,
  type ReturnError,
  type ReturnLineInput,
} from "@/lib/returns/eligibility";
import { allocateRefund, computeReturnRefund } from "@/lib/returns/refund";
import { audit } from "@/server/audit";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { db } from "@/server/db";
import { refundPaymentIntent } from "@/server/payments/stripe";
import { getSettings } from "@/server/settings";
import { sendReturnEmail, notifyAdminsOfReturn } from "@/server/email/return-emails";

// Return requests (RMAs). Customers ask from their order page; staff approve
// or decline, then receive and inspect the items, which restocks or writes
// them off and refunds the customer.

const requestInclude = {
  lines: { include: { orderLine: true } },
  order: {
    select: { id: true, number: true, name: true, email: true, locale: true, accessToken: true },
  },
} as const;

export async function loadOrderForReturn(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      lines: { orderBy: { id: "asc" } },
      returns: { include: { lines: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type ReturnRequestInput = {
  reason: ReturnReason;
  details: string;
  lines: ReturnLineInput[];
};

export async function createReturnRequest(
  orderId: string,
  input: ReturnRequestInput,
  userId: string | null,
): Promise<{ ok: true; number: number } | { ok: false; error: ReturnError }> {
  const settings = await getSettings();
  const result = await db.$transaction(async (tx) => {
    // Lock the order so two requests sent at once can't claim the same items.
    await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true, returns: { include: { lines: true } } },
    });
    if (!order) return { ok: false as const, error: "notEligible" as const };
    const checked = validateReturn(order, input, new Date(), settings.returnWindowDays);
    if (!checked.ok) return checked;

    const request = await tx.returnRequest.create({
      data: {
        orderId,
        userId,
        reason: input.reason,
        details: input.details,
        lines: { create: checked.lines },
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "return:requested",
        message: `RMA-${request.number}`,
        actorId: userId,
      },
    });
    return { ok: true as const, id: request.id, number: request.number };
  });
  if (!result.ok) return result;

  const request = await loadReturn(result.id);
  if (request) {
    await sendReturnEmail(request, "requested");
    await notifyAdminsOfReturn(request);
  }
  return { ok: true, number: result.number };
}

export async function loadReturn(id: string) {
  const request = await db.returnRequest.findUnique({ where: { id }, include: requestInclude });
  if (!request) return null;
  const [order, settings] = await Promise.all([
    db.order.findUniqueOrThrow({ where: { id: request.orderId }, select: { lines: true } }),
    getSettings(),
  ]);
  return {
    ...request,
    feeCents:
      request.restockingFeeCents ??
      estimateRestockingFee(
        order,
        { reason: request.reason, lines: request.lines },
        settings.restockingPercent,
      ),
  };
}

export type ReturnView = NonNullable<Awaited<ReturnType<typeof loadReturn>>>;

export type ReturnListFilter = "open" | "approved" | "all";

export async function listReturns(filter: ReturnListFilter = "open") {
  const settings = await getSettings();
  const requests = await db.returnRequest.findMany({
    where: filter === "all" ? {} : { status: filter === "approved" ? "APPROVED" : "REQUESTED" },
    orderBy: { createdAt: filter === "all" ? "desc" : "asc" },
    include: {
      ...requestInclude,
      order: {
        select: {
          ...requestInclude.order.select,
          lines: true,
          subtotalCents: true,
          deliveryCents: true,
          assemblyCents: true,
          taxCents: true,
          paidCents: true,
          refundedCents: true,
          payments: { where: { method: "CARD", status: "SUCCEEDED" }, select: { id: true } },
        },
      },
      refunds: { select: { method: true, amountCents: true } },
    },
    take: 200,
  });
  return requests.map(({ order: { lines, payments, ...order }, ...request }) => ({
    ...request,
    order: { ...order, lines, paidByCard: payments.length > 0 },
    feeCents:
      request.restockingFeeCents ??
      estimateRestockingFee(
        { lines },
        { reason: request.reason, lines: request.lines },
        settings.restockingPercent,
      ),
  }));
}

export type ReturnListItem = Awaited<ReturnType<typeof listReturns>>[number];

export async function decideReturn(
  id: string,
  decision: "APPROVED" | "DECLINED",
  note: string,
  actorId: string,
): Promise<{ ok: boolean }> {
  const { count } = await db.returnRequest.updateMany({
    where: { id, status: "REQUESTED" },
    data: {
      status: decision,
      adminNote: note || null,
      decidedAt: new Date(),
      decidedById: actorId,
    },
  });
  if (!count) return { ok: false };
  const request = (await loadReturn(id))!;
  await db.orderEvent.create({
    data: {
      orderId: request.orderId,
      type: `return:${decision.toLowerCase()}`,
      message: `RMA-${request.number}${note ? `: ${note}` : ""}`,
      actorId,
    },
  });
  await sendReturnEmail(request, decision === "APPROVED" ? "approved" : "declined");
  return { ok: true };
}

// ─── Receiving and refunding ────────────────────────────────────────────────

export type CompleteReturnInput = {
  conditions: Record<string, ReturnCondition>; // by ReturnLine id
  feeCents: number;
  // CARD refunds through Stripe; ETRANSFER and CASH are sent by staff first.
  method: PaymentMethod;
  actorId: string;
};

export async function completeReturn(
  id: string,
  input: CompleteReturnInput,
): Promise<{ ok: true; refundCents: number } | { ok: false; error: string }> {
  const request = await db.returnRequest.findUnique({
    where: { id },
    include: {
      lines: true,
      order: {
        include: {
          lines: true,
          payments: {
            where: { method: "CARD", status: "SUCCEEDED" },
            orderBy: { createdAt: "desc" },
          },
          refunds: true,
        },
      },
    },
  });
  if (!request) return { ok: false, error: "Return not found." };
  if (request.status !== "APPROVED")
    return { ok: false, error: "Only approved returns can be received." };
  if (request.lines.some((l) => !input.conditions[l.id])) {
    return { ok: false, error: "Choose restock or write off for every item." };
  }
  const { order } = request;
  const breakdown = computeReturnRefund(order, request.lines, input.feeCents);
  const refundable = order.paidCents - order.refundedCents;
  if (breakdown.refundCents > refundable) {
    return {
      ok: false,
      error: `Only $${(refundable / 100).toFixed(2)} paid on this order is left to refund.`,
    };
  }

  // Card refunds go to Stripe first, so we never record money we didn't return.
  let stripeRefunds: { paymentId: string; refundId: string; amountCents: number }[] = [];
  if (input.method === "CARD" && breakdown.refundCents > 0) {
    const alreadyRefunded = (paymentId: string) =>
      order.refunds
        .filter((r) => r.paymentId === paymentId)
        .reduce((sum, r) => sum + r.amountCents, 0);
    const plan = allocateRefund(
      breakdown.refundCents,
      order.payments.map((p) => ({
        id: p.id,
        availableCents: p.amountCents - alreadyRefunded(p.id),
      })),
    );
    if (!plan)
      return {
        ok: false,
        error: "The card payments can't cover this refund; refund the rest by e-Transfer.",
      };
    for (const part of plan) {
      const payment = order.payments.find((p) => p.id === part.id)!;
      if (!payment.stripePaymentIntentId) {
        return { ok: false, error: "A card payment has no Stripe reference; refund it in Stripe." };
      }
      const refund = await refundPaymentIntent(
        payment.stripePaymentIntentId,
        part.amountCents,
        order.id,
        `return-${request.id}-${payment.id}`,
      );
      stripeRefunds.push({
        paymentId: payment.id,
        refundId: refund.id,
        amountCents: part.amountCents,
      });
    }
  }
  if (input.method !== "CARD") stripeRefunds = [];

  await db.$transaction(async (tx) => {
    for (const line of request.lines) {
      const condition = input.conditions[line.id];
      await tx.returnLine.update({ where: { id: line.id }, data: { condition } });
      if (condition === "RESTOCK") {
        const orderLine = order.lines.find((l) => l.id === line.orderLineId)!;
        const key = { productId: orderLine.productId, locationId: order.locationId };
        await tx.inventory.upsert({
          where: { productId_locationId: key },
          create: { ...key, onHand: line.quantity },
          update: { onHand: { increment: line.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            ...key,
            delta: line.quantity,
            reason: "RETURN",
            note: `RMA-${request.number}`,
            actorId: input.actorId,
          },
        });
      }
    }
    if (breakdown.refundCents > 0) {
      const rows =
        input.method === "CARD"
          ? stripeRefunds.map((r, i) => ({
              paymentId: r.paymentId,
              stripeRefundId: r.refundId,
              amountCents: r.amountCents,
              restockingFeeCents: i === 0 ? breakdown.feeCents : 0,
            }))
          : [
              {
                paymentId: null,
                stripeRefundId: null,
                amountCents: breakdown.refundCents,
                restockingFeeCents: breakdown.feeCents,
              },
            ];
      for (const row of rows) {
        await tx.refund.create({
          data: {
            ...row,
            orderId: order.id,
            returnId: request.id,
            method: input.method,
            reason: `RMA-${request.number}`,
            actorId: input.actorId,
          },
        });
      }
    }
    const refundedCents = order.refundedCents + breakdown.refundCents;
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedCents,
        ...(breakdown.refundCents > 0
          ? { paymentStatus: refundedCents >= order.paidCents ? "REFUNDED" : "PARTIALLY_REFUNDED" }
          : {}),
      },
    });
    await tx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: "COMPLETED",
        receivedAt: new Date(),
        restockingFeeCents: breakdown.feeCents,
        refundCents: breakdown.refundCents,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "return:completed",
        message: `RMA-${request.number}: refunded ${(breakdown.refundCents / 100).toFixed(2)} by ${input.method.toLowerCase()}${breakdown.feeCents ? `, fee ${(breakdown.feeCents / 100).toFixed(2)}` : ""}`,
        actorId: input.actorId,
      },
    });
    await audit(
      {
        actorId: input.actorId,
        action: "return.complete",
        entity: "return",
        entityId: request.id,
        summary: `Received RMA-${request.number}; refunded $${(breakdown.refundCents / 100).toFixed(2)} by ${input.method.toLowerCase()}`,
        details: { ...breakdown, conditions: input.conditions },
      },
      tx,
    );
  });

  // Restocked items show up on the storefront again.
  revalidateTag(CATALOG_TAG, "max");
  const view = await loadReturn(request.id);
  if (view) await sendReturnEmail(view, "refunded");
  return { ok: true, refundCents: breakdown.refundCents };
}
