import { describe, expect, it } from "vitest";

import { allocateRefund, computeReturnRefund } from "./refund";

const order = {
  subtotalCents: 30_000,
  deliveryCents: 2_500,
  assemblyCents: 0,
  // 13% HST on $325.
  taxCents: 4_225,
  lines: [
    { id: "a", unitPriceCents: 10_000 },
    { id: "b", unitPriceCents: 20_000 },
  ],
};

describe("computeReturnRefund", () => {
  it("refunds the items and their share of tax, minus the fee", () => {
    expect(computeReturnRefund(order, [{ orderLineId: "a", quantity: 1 }], 3_000)).toEqual({
      itemsCents: 10_000,
      taxCents: 1_300,
      feeCents: 3_000,
      refundCents: 8_300,
    });
  });

  it("never charges more fee than the items are worth", () => {
    expect(computeReturnRefund(order, [{ orderLineId: "a", quantity: 1 }], 50_000).feeCents).toBe(
      10_000,
    );
  });

  it("handles orders without tax", () => {
    expect(
      computeReturnRefund({ ...order, taxCents: 0 }, [{ orderLineId: "b", quantity: 1 }], 0),
    ).toEqual({ itemsCents: 20_000, taxCents: 0, feeCents: 0, refundCents: 20_000 });
  });
});

describe("allocateRefund", () => {
  it("spreads a refund over payments in order", () => {
    expect(
      allocateRefund(15_000, [
        { id: "balance", availableCents: 10_000 },
        { id: "deposit", availableCents: 9_000 },
      ]),
    ).toEqual([
      { id: "balance", amountCents: 10_000 },
      { id: "deposit", amountCents: 5_000 },
    ]);
  });

  it("returns null when the payments can't cover it", () => {
    expect(allocateRefund(5_000, [{ id: "p", availableCents: 4_000 }])).toBeNull();
  });
});
