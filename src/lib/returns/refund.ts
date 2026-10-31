import type { ReturnLineInput } from "./eligibility";

// What a completed return gives back: the items' price plus the share of tax
// charged on them, minus any restocking fee. Delivery and assembly fees are
// not refunded.

export type OrderForRefund = {
  subtotalCents: number;
  deliveryCents: number;
  assemblyCents: number;
  taxCents: number;
  lines: { id: string; unitPriceCents: number }[];
};

export type RefundBreakdown = {
  itemsCents: number;
  taxCents: number;
  feeCents: number;
  refundCents: number;
};

export function computeReturnRefund(
  order: OrderForRefund,
  items: ReturnLineInput[],
  feeCents: number,
): RefundBreakdown {
  const price = new Map(order.lines.map((l) => [l.id, l.unitPriceCents]));
  const itemsCents = items.reduce(
    (sum, i) => sum + (price.get(i.orderLineId) ?? 0) * i.quantity,
    0,
  );
  // Tax was charged on goods, delivery and assembly together.
  const taxable = order.subtotalCents + order.deliveryCents + order.assemblyCents;
  const taxCents = taxable > 0 ? Math.round((order.taxCents * itemsCents) / taxable) : 0;
  const fee = Math.max(0, Math.min(feeCents, itemsCents));
  return { itemsCents, taxCents, feeCents: fee, refundCents: itemsCents + taxCents - fee };
}

// Splits a refund across card payments, newest first, without refunding any
// payment for more than is left on it.
export function allocateRefund(
  amountCents: number,
  payments: { id: string; availableCents: number }[],
): { id: string; amountCents: number }[] | null {
  let left = amountCents;
  const plan: { id: string; amountCents: number }[] = [];
  for (const payment of payments) {
    if (left <= 0) break;
    const take = Math.min(left, payment.availableCents);
    if (take > 0) plan.push({ id: payment.id, amountCents: take });
    left -= take;
  }
  return left > 0 ? null : plan;
}
