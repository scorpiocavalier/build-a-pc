import { describe, expect, it } from "vitest";

import { matchesCost, matchesStock, parseStockLevel, type CostRow } from "./filter";

const row = (onHand: number, reserved = 0) => ({ stock: { onHand, reserved } });

describe("matchesStock", () => {
  it("counts free stock (on hand minus reserved)", () => {
    expect(matchesStock(row(3, 3), "out", 2)).toBe(true);
    expect(matchesStock(row(3, 3), "in", 2)).toBe(false);
    expect(matchesStock(row(3), "in", 2)).toBe(true);
    expect(matchesStock(row(0), "out", 2)).toBe(true);
  });

  it("flags low stock at or under the threshold", () => {
    expect(matchesStock(row(2), "low", 2)).toBe(true);
    expect(matchesStock(row(10, 8), "low", 2)).toBe(true);
    expect(matchesStock(row(10), "low", 2)).toBe(false);
  });

  it("lets everything through without a stock filter", () => {
    expect(matchesStock(row(0), "all", 2)).toBe(true);
  });
});

describe("parsers", () => {
  it("fall back to all for unknown values", () => {
    expect(parseStockLevel("low")).toBe("low");
    expect(parseStockLevel("nope")).toBe("all");
  });
});

describe("matchesCost", () => {
  const rules = { targetMarginPercent: 15, costDriftPercent: 10 };
  const row = (stock: Partial<CostRow["stock"]>): CostRow => ({
    priceCents: 10_000,
    stock: { onHand: 1, avgCostCents: 7_000, lastCostCents: 7_000, ...stock },
  });
  it("flags a margin under the target", () => {
    expect(matchesCost(row({ avgCostCents: 9_000, lastCostCents: 9_000 }), "review", rules)).toBe(
      true,
    );
    expect(matchesCost(row({}), "review", rules)).toBe(false);
  });
  it("flags a last purchase far from the average", () => {
    expect(matchesCost(row({ lastCostCents: 8_000 }), "review", rules)).toBe(true);
    expect(matchesCost(row({ lastCostCents: 7_500 }), "review", rules)).toBe(false);
  });
  it("finds stock with no cost", () => {
    expect(matchesCost(row({ avgCostCents: null }), "nocost", rules)).toBe(true);
    expect(matchesCost(row({ avgCostCents: null, onHand: 0 }), "nocost", rules)).toBe(false);
  });
});
