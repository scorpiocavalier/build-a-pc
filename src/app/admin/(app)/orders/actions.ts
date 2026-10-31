"use server";

import { refresh } from "next/cache";

import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import { parseDollars } from "@/lib/money";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { storeTimeToDate } from "@/lib/store-time";
import {
  cancelOrder,
  changeStatus,
  recordPayment,
  scheduleOrder,
  sendBalanceLink,
} from "@/server/orders/lifecycle";
import { requireAdmin } from "@/server/require-admin";

export type ActionState = { error?: string; ok?: boolean };

// Used with useActionState, which also passes the previous state; not needed.
export async function changeStatusAction(
  orderId: string,
  to: Exclude<OrderStatus, "CANCELLED">,
): Promise<ActionState> {
  const user = await requireAdmin();
  try {
    await changeStatus(orderId, to, user.id);
    await audit({
      actorId: user.id,
      action: "order.status",
      entity: "order",
      entityId: orderId,
      summary: `Moved order to ${to.toLowerCase().replaceAll("_", " ")}`,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't change the status" };
  }
  refresh();
  return { ok: true };
}

export async function recordPaymentAction(
  orderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const method = String(formData.get("method")) as PaymentMethod;
  if (method !== "ETRANSFER" && method !== "CASH") {
    return { error: "Card payments are recorded automatically by Stripe." };
  }
  const amountCents = parseDollars(String(formData.get("amount") ?? ""));
  if (!amountCents) return { error: "Enter the amount received, e.g. 649.99" };

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "CANCELLED") return { error: "This order is cancelled." };
  if (amountCents > order.totalCents - order.paidCents) {
    return { error: "That's more than the amount still owing." };
  }
  await recordPayment(orderId, {
    method,
    amountCents,
    reference: String(formData.get("reference") ?? "").trim() || null,
    actorId: user.id,
  });
  await audit({
    actorId: user.id,
    action: "order.payment",
    entity: "order",
    entityId: orderId,
    summary: `Recorded ${method === "CASH" ? "cash" : "e-Transfer"} payment of $${(amountCents / 100).toFixed(2)}`,
  });
  refresh();
  return { ok: true };
}

export async function cancelOrderAction(
  orderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason; it's included in the email to the customer." };
  try {
    await cancelOrder(orderId, {
      reason,
      actorId: user.id,
      offlineRefunded: formData.get("offlineRefunded") === "on",
    });
    await audit({
      actorId: user.id,
      action: "order.cancel",
      entity: "order",
      entityId: orderId,
      summary: `Cancelled order: ${reason}`,
    });
  } catch (error) {
    console.error("[admin] cancel failed", error);
    return { error: "Couldn't cancel. If the card refund failed, refund it in Stripe first." };
  }
  refresh();
  return { ok: true };
}

export async function scheduleOrderAction(
  orderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const when = storeTimeToDate(
    String(formData.get("date") ?? ""),
    String(formData.get("time") ?? ""),
  );
  if (!when) return { error: "Pick a date and time." };
  const result = await scheduleOrder(orderId, when, user.id);
  if (!result.ok) return { error: result.error };
  await audit({
    actorId: user.id,
    action: "order.schedule",
    entity: "order",
    entityId: orderId,
    summary: `Booked for ${new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(when)}`,
  });
  refresh();
  return { ok: true };
}

export async function sendBalanceLinkAction(orderId: string): Promise<ActionState> {
  const user = await requireAdmin();
  let result;
  try {
    result = await sendBalanceLink(orderId, user.id);
  } catch (error) {
    console.error("[admin] payment link failed", error);
    return { error: "Stripe couldn't create the link. Try again in a minute." };
  }
  if (!result.ok) return { error: result.error };
  await audit({
    actorId: user.id,
    action: "order.payment_link",
    entity: "order",
    entityId: orderId,
    summary: `Emailed a card payment link for $${(result.amountCents / 100).toFixed(2)}`,
  });
  refresh();
  return { ok: true };
}
