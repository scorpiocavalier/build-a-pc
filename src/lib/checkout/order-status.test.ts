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
