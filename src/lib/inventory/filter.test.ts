import { describe, expect, it } from "vitest";

import { matchesStock, parseLocation, parseStockLevel } from "./filter";

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
