import { describe, expect, it } from "vitest";

import { canTransition, nextStatuses } from "./order-status";

const pickup = { fulfilment: "PICKUP", paymentStatus: "UNPAID" } as const;

describe("order status transitions", () => {
  it("follows the lifecycle and allows cancelling until completion", () => {
    expect(nextStatuses({ ...pickup, status: "PLACED" })).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(nextStatuses({ ...pickup, status: "COMPLETED", paymentStatus: "PAID" })).toEqual([]);
    expect(nextStatuses({ ...pickup, status: "CANCELLED" })).toEqual([]);
  });

  it("only sends delivery orders out for delivery", () => {
    expect(nextStatuses({ ...pickup, status: "READY", paymentStatus: "PAID" })).toEqual([
      "COMPLETED",
      "CANCELLED",
    ]);
    expect(
      nextStatuses({ fulfilment: "DELIVERY", paymentStatus: "PAID", status: "READY" }),
    ).toEqual(["OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]);
  });

  it("won't complete an order that isn't fully paid", () => {
    expect(
      canTransition({ ...pickup, status: "READY", paymentStatus: "PARTIALLY_PAID" }, "COMPLETED"),
    ).toEqual({
      ok: false,
      reason: "Record the full payment before completing the order",
    });
  });

  it("rejects skipping steps", () => {
    expect(canTransition({ ...pickup, status: "PLACED" }, "READY").ok).toBe(false);
  });
});

describe("assembled orders", () => {
  const assembled = {
    fulfilment: "PICKUP",
    paymentStatus: "PARTIALLY_PAID",
    assemblyCents: 14999,
    depositCents: 60000,
  } as const;

  it("can't be confirmed until the deposit is in", () => {
    expect(canTransition({ ...assembled, status: "PLACED", paidCents: 0 }, "CONFIRMED")).toEqual({
      ok: false,
      reason: "Record the deposit before confirming this order",
    });
    expect(
      canTransition({ ...assembled, status: "PLACED", paidCents: 60000 }, "CONFIRMED").ok,
    ).toBe(true);
  });

  it("go through assembly before being ready; parts-only orders skip it", () => {
    expect(nextStatuses({ ...assembled, status: "CONFIRMED", paidCents: 60000 })).toEqual([
      "ASSEMBLING",
      "CANCELLED",
    ]);
    expect(nextStatuses({ ...assembled, status: "ASSEMBLING", paidCents: 60000 })).toEqual([
      "READY",
      "CANCELLED",
    ]);
    expect(nextStatuses({ ...pickup, status: "CONFIRMED" })).toEqual(["READY", "CANCELLED"]);
  });
});
