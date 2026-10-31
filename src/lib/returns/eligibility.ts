import type { ReturnReason, ReturnStatus } from "@/generated/prisma/enums";

// The return policy (docs/PLAN.md): 30 days from handover; assembled PCs only
// when defective; a 30% restocking fee on returns that aren't our fault.

export const RETURN_WINDOW_DAYS = 30;
export const RESTOCKING_PERCENT = 30;
export const RETURN_REASONS = [
  "DEFECTIVE",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
  "OTHER",
] as const satisfies readonly ReturnReason[];

// Reasons where the item is fine, so the restocking fee applies.
const FEE_REASONS: ReturnReason[] = ["CHANGED_MIND", "OTHER"];

export type OrderForReturn = {
  status: string;
  completedAt: Date | null;
  lines: { id: string; quantity: number; unitPriceCents: number; buildGroup: string | null }[];
  returns: { status: ReturnStatus; lines: { orderLineId: string; quantity: number }[] }[];
};

export type ReturnLineInput = { orderLineId: string; quantity: number };

export type ReturnError = "notEligible" | "expired" | "noItems" | "quantity" | "assembledDefective";

export function returnWindowEnds(completedAt: Date): Date {
  return new Date(completedAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// Why the order can't take a new return request, or null if it can.
export function returnBlocker(order: OrderForReturn, now: Date): ReturnError | null {
  if (order.status !== "COMPLETED" || !order.completedAt) return "notEligible";
  if (now > returnWindowEnds(order.completedAt)) return "expired";
  const left = returnableQuantities(order);
  if (Object.values(left).every((n) => n === 0)) return "noItems";
  return null;
}

// How many of each line can still be returned: requests that weren't
// declined already claim their items.
export function returnableQuantities(order: OrderForReturn): Record<string, number> {
  const left = Object.fromEntries(order.lines.map((l) => [l.id, l.quantity]));
  for (const request of order.returns) {
    if (request.status === "DECLINED") continue;
    for (const line of request.lines) {
      if (line.orderLineId in left) left[line.orderLineId] -= line.quantity;
    }
  }
  for (const id in left) left[id] = Math.max(0, left[id]);
  return left;
}

export function validateReturn(
  order: OrderForReturn,
  request: { reason: ReturnReason; lines: ReturnLineInput[] },
  now: Date,
): { ok: true; lines: ReturnLineInput[] } | { ok: false; error: ReturnError } {
  const blocker = returnBlocker(order, now);
  if (blocker) return { ok: false, error: blocker };

  const left = returnableQuantities(order);
  const lines = request.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) return { ok: false, error: "noItems" };
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.orderLineId)) return { ok: false, error: "quantity" };
    seen.add(line.orderLineId);
    if (!Number.isInteger(line.quantity) || line.quantity > (left[line.orderLineId] ?? 0)) {
      return { ok: false, error: "quantity" };
    }
  }
  const assembled = new Set(order.lines.filter((l) => l.buildGroup).map((l) => l.id));
  if (request.reason !== "DEFECTIVE" && lines.some((l) => assembled.has(l.orderLineId))) {
    return { ok: false, error: "assembledDefective" };
  }
  return { ok: true, lines };
}

// The most the restocking fee can be. Staff confirm the final amount after
// inspecting the items (Phase 5).
export function estimateRestockingFee(
  order: Pick<OrderForReturn, "lines">,
  request: { reason: ReturnReason; lines: ReturnLineInput[] },
): number {
  if (!FEE_REASONS.includes(request.reason)) return 0;
  const price = new Map(order.lines.map((l) => [l.id, l.unitPriceCents]));
  const value = request.lines.reduce(
    (sum, l) => sum + (price.get(l.orderLineId) ?? 0) * l.quantity,
    0,
  );
  return Math.round((value * RESTOCKING_PERCENT) / 100);
}
