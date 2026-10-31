import { describe, expect, it } from "vitest";

import {
  estimateRestockingFee,
  returnBlocker,
  returnableQuantities,
  validateReturn,
  type OrderForReturn,
} from "./eligibility";

const completedAt = new Date("2026-10-01T15:00:00Z");
const day = (n: number) => new Date(completedAt.getTime() + n * 24 * 60 * 60 * 1000);

const order: OrderForReturn = {
  status: "COMPLETED",
  completedAt,
  lines: [
    { id: "ssd", quantity: 2, unitPriceCents: 10_000, buildGroup: null },
    { id: "cpu", quantity: 1, unitPriceCents: 40_000, buildGroup: "pc1" },
  ],
  returns: [],
};

describe("returnBlocker", () => {
  it("allows returns for 30 days after handover", () => {
    expect(returnBlocker(order, day(29))).toBeNull();
    expect(returnBlocker(order, day(30))).toBeNull();
    expect(returnBlocker(order, day(31))).toBe("expired");
  });

  it("needs the order to have been handed over", () => {
    expect(returnBlocker({ ...order, status: "READY", completedAt: null }, day(1))).toBe(
      "notEligible",
    );
  });

  it("stops once everything has been requested", () => {
    const all: OrderForReturn = {
      ...order,
      returns: [
        {
          status: "REQUESTED",
          lines: [
            { orderLineId: "ssd", quantity: 2 },
            { orderLineId: "cpu", quantity: 1 },
          ],
        },
      ],
    };
    expect(returnBlocker(all, day(1))).toBe("noItems");
  });
});

describe("returnableQuantities", () => {
  it("subtracts open and approved requests but not declined ones", () => {
    const withReturns: OrderForReturn = {
      ...order,
      returns: [
        { status: "APPROVED", lines: [{ orderLineId: "ssd", quantity: 1 }] },
        { status: "DECLINED", lines: [{ orderLineId: "cpu", quantity: 1 }] },
      ],
    };
    expect(returnableQuantities(withReturns)).toEqual({ ssd: 1, cpu: 1 });
  });
});

describe("validateReturn", () => {
  it("accepts a request within the limits, ignoring zero quantities", () => {
    expect(
      validateReturn(
        order,
        {
          reason: "CHANGED_MIND",
          lines: [
            { orderLineId: "ssd", quantity: 1 },
            { orderLineId: "cpu", quantity: 0 },
          ],
        },
        day(2),
      ),
    ).toEqual({ ok: true, lines: [{ orderLineId: "ssd", quantity: 1 }] });
  });

  it("rejects empty, excessive, unknown and duplicated lines", () => {
    const check = (lines: { orderLineId: string; quantity: number }[]) =>
      validateReturn(order, { reason: "DEFECTIVE", lines }, day(2));
    expect(check([])).toEqual({ ok: false, error: "noItems" });
    expect(check([{ orderLineId: "ssd", quantity: 3 }])).toEqual({ ok: false, error: "quantity" });
    expect(check([{ orderLineId: "gpu", quantity: 1 }])).toEqual({ ok: false, error: "quantity" });
    expect(
      check([
        { orderLineId: "ssd", quantity: 1 },
        { orderLineId: "ssd", quantity: 1 },
      ]),
    ).toEqual({ ok: false, error: "quantity" });
  });

  it("only takes back assembled PC parts when they're defective", () => {
    const cpu = [{ orderLineId: "cpu", quantity: 1 }];
    expect(validateReturn(order, { reason: "CHANGED_MIND", lines: cpu }, day(2))).toEqual({
      ok: false,
      error: "assembledDefective",
    });
    expect(validateReturn(order, { reason: "DEFECTIVE", lines: cpu }, day(2)).ok).toBe(true);
  });
});

describe("estimateRestockingFee", () => {
  const lines = [{ orderLineId: "ssd", quantity: 2 }];
  it("charges 30% when the item isn't faulty", () => {
    expect(estimateRestockingFee(order, { reason: "CHANGED_MIND", lines })).toBe(6_000);
  });
  it("charges nothing for defective, wrong or misdescribed items", () => {
    for (const reason of ["DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED"] as const) {
      expect(estimateRestockingFee(order, { reason, lines })).toBe(0);
    }
  });
});
