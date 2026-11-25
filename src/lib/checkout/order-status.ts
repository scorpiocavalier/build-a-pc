import type { Fulfilment, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

// Allowed order status changes (docs/PLAN.md §5). Cancelling releases the
// stock reservation; completing deducts it. Orders with an assembled PC go
// through ASSEMBLING; parts-only orders skip it.

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ASSEMBLING", "READY", "CANCELLED"],
  ASSEMBLING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "READY", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type OrderForTransition = {
  status: OrderStatus;
  fulfilment: Fulfilment;
  paymentStatus: PaymentStatus;
  // Lines with a build group belong to an assembled PC.
  lines?: readonly { buildGroup: string | null }[];
  depositCents?: number;
  paidCents?: number;
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

// Whether the order includes an assembled PC. Older orders also carry an
// assembly fee, but new ones don't, so the build lines are what count.
export function isAssembled(order: { lines?: readonly { buildGroup: string | null }[] }): boolean {
  return (order.lines ?? []).some((line) => line.buildGroup !== null);
}

// Orders placed since assembly became free include Windows 11 Pro with each
// assembled PC. Older ones were charged a fee and list the licence they got.
export function includesWindowsPro(order: {
  assemblyCents: number;
  lines: readonly { buildGroup: string | null }[];
}): boolean {
  return isAssembled(order) && order.assemblyCents === 0;
}

export function canTransition(order: OrderForTransition, to: OrderStatus): TransitionCheck {
  if (!NEXT[order.status].includes(to)) {
    return { ok: false, reason: `Can't go from ${order.status} to ${to}` };
  }
  const assembled = isAssembled(order);
  if (to === "CONFIRMED" && (order.paidCents ?? 0) < (order.depositCents ?? 0)) {
    return { ok: false, reason: "Record the deposit before confirming this order" };
  }
  if (to === "ASSEMBLING" && !assembled) {
    return { ok: false, reason: "Only orders with an assembled PC are assembled" };
  }
  if (to === "READY" && order.status === "CONFIRMED" && assembled) {
    return { ok: false, reason: "Start assembly before marking the order ready" };
  }
  if (to === "OUT_FOR_DELIVERY" && order.fulfilment !== "DELIVERY") {
    return { ok: false, reason: "Only delivery orders go out for delivery" };
  }
  if (to === "COMPLETED" && order.paymentStatus !== "PAID") {
    return { ok: false, reason: "Record the full payment before completing the order" };
  }
  return { ok: true };
}

export function nextStatuses(order: OrderForTransition): OrderStatus[] {
  return NEXT[order.status].filter((to) => canTransition(order, to).ok);
}
