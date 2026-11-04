import { describe, expect, it } from "vitest";

import { driftPercent, landedUnitCosts, marginPercent, weightedAverage } from "./cost";

describe("weightedAverage", () => {
  it("weights by units on hand, not by purchase", () => {
    // 2 left at $10, 10 more at $12.
    expect(weightedAverage(2, 1000, 10, 1200)).toBeCloseTo(1166.67, 2);
  });
  it("starts from the new cost when nothing is on hand or the cost is unknown", () => {
    expect(weightedAverage(0, 1000, 5, 1200)).toBe(1200);
    expect(weightedAverage(3, null, 5, 1200)).toBe(1200);
  });
});

describe("landedUnitCosts", () => {
  const lines = [
    { quantity: 1, unitCostCents: 50_000 }, // GPU
    { quantity: 10, unitCostCents: 1_000 }, // cables
  ];
  it("splits extra costs by value", () => {
    const [gpu, cable] = landedUnitCosts(lines, 6_000, "VALUE");
    expect(gpu).toBeCloseTo(55_000);
    expect(cable).toBeCloseTo(1_100);
  });
  it("splits extra costs by units", () => {
    const [gpu, cable] = landedUnitCosts(lines, 5_500, "UNITS");
    expect(gpu).toBeCloseTo(50_500);
    expect(cable).toBeCloseTo(1_500);
  });
  it("keeps the total", () => {
    const costs = landedUnitCosts(lines, 1_234, "VALUE");
    const total = costs.reduce((s, c, i) => s + c * lines[i].quantity, 0);
    expect(total).toBeCloseTo(60_000 + 1_234);
  });
  it("falls back to units when everything is free", () => {
    expect(landedUnitCosts([{ quantity: 2, unitCostCents: 0 }], 400, "VALUE")).toEqual([200]);
  });
});

describe("margins", () => {
  it("computes margin on price", () => {
    expect(marginPercent(1500, 1166.67)).toBeCloseTo(22.2, 1);
    expect(marginPercent(1500, null)).toBeNull();
  });
  it("computes drift from the average", () => {
    expect(driftPercent(1200, 1000)).toBeCloseTo(20);
    expect(driftPercent(null, 1000)).toBeNull();
  });
});
