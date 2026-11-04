import { describe, expect, it } from "vitest";

import { matchesCost, matchesStock, parseLocation, parseStockLevel, type CostRow } from "./filter";

const row = (tor: number, mtl: number, reserved = 0) => ({
  stock: { TOR: { onHand: tor, reserved }, MTL: { onHand: mtl, reserved: 0 } },
});

describe("matchesStock", () => {
  it("counts free stock (on hand minus reserved) at the chosen location", () => {
    expect(matchesStock(row(3, 0, 3), "out", "TOR", 2)).toBe(true);
    expect(matchesStock(row(3, 0), "in", "MTL", 2)).toBe(false);
    expect(matchesStock(row(3, 0), "in", "TOR", 2)).toBe(true);
  });

  it("with both locations: in or low anywhere, out only when out everywhere", () => {
    expect(matchesStock(row(10, 1), "low", "all", 2)).toBe(true);
    expect(matchesStock(row(10, 0), "out", "all", 2)).toBe(false);
    expect(matchesStock(row(0, 0), "out", "all", 2)).toBe(true);
    expect(matchesStock(row(0, 5), "in", "all", 2)).toBe(true);
  });

  it("lets everything through without a stock filter", () => {
    expect(matchesStock(row(0, 0), "all", "TOR", 2)).toBe(true);
  });
});

describe("parsers", () => {
  it("fall back to all for unknown values", () => {
    expect(parseStockLevel("low")).toBe("low");
    expect(parseStockLevel("nope")).toBe("all");
    expect(parseLocation("MTL")).toBe("MTL");
    expect(parseLocation(undefined)).toBe("all");
  });
});

describe("matchesCost", () => {
  const rules = { targetMarginPercent: 15, costDriftPercent: 10 };
  const row = (
    tor: Partial<CostRow["stock"]["TOR"]>,
    mtl: Partial<CostRow["stock"]["MTL"]> = {},
  ) => ({
    priceCents: 10_000,
    stock: {
      TOR: { onHand: 1, avgCostCents: 7_000, lastCostCents: 7_000, ...tor },
      MTL: { onHand: 1, avgCostCents: 7_000, lastCostCents: 7_000, ...mtl },
    },
  });
  it("flags a margin under the target", () => {
    expect(
      matchesCost(row({ avgCostCents: 9_000, lastCostCents: 9_000 }), "review", "all", rules),
    ).toBe(true);
    expect(matchesCost(row({}), "review", "all", rules)).toBe(false);
  });
  it("flags a last purchase far from the average", () => {
    expect(matchesCost(row({ lastCostCents: 8_000 }), "review", "all", rules)).toBe(true);
    expect(matchesCost(row({ lastCostCents: 7_500 }), "review", "all", rules)).toBe(false);
  });
  it("looks only at the chosen location", () => {
    const r = row({}, { avgCostCents: 9_500 });
    expect(matchesCost(r, "review", "TOR", rules)).toBe(false);
    expect(matchesCost(r, "review", "MTL", rules)).toBe(true);
  });
  it("finds stock with no cost", () => {
    expect(matchesCost(row({ avgCostCents: null }), "nocost", "all", rules)).toBe(true);
    expect(matchesCost(row({ avgCostCents: null, onHand: 0 }), "nocost", "all", rules)).toBe(false);
  });
});
