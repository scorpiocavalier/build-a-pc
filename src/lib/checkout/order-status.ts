import type { Fulfilment, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

// Allowed order status changes (docs/PLAN.md §5). Cancelling releases the
// stock reservation; completing deducts it.

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "READY", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function canTransition(
  order: { status: OrderStatus; fulfilment: Fulfilment; paymentStatus: PaymentStatus },
  to: OrderStatus,
): TransitionCheck {
  if (!NEXT[order.status].includes(to)) {
    return { ok: false, reason: `Can't go from ${order.status} to ${to}` };
  }
  if (to === "OUT_FOR_DELIVERY" && order.fulfilment !== "DELIVERY") {
    return { ok: false, reason: "Only delivery orders go out for delivery" };
  }
  if (to === "COMPLETED" && order.paymentStatus !== "PAID") {
    return { ok: false, reason: "Record the full payment before completing the order" };
  }
  return { ok: true };
}

export function nextStatuses(order: {
  status: OrderStatus;
  fulfilment: Fulfilment;
  paymentStatus: PaymentStatus;
}): OrderStatus[] {
  return NEXT[order.status].filter((to) => canTransition(order, to).ok);
}
