import { LOCATION_CODES } from "@/lib/store-config";

import { driftPercent, marginPercent } from "./cost";

// Inventory page filters that depend on stock numbers, applied after the
// database query. "Free" = on hand − reserved for open orders.

export type StockLevel = "all" | "in" | "low" | "out";
export type LocationFilter = "all" | "TOR" | "MTL";

export type StockRow = {
  stock: Record<"TOR" | "MTL", { onHand: number; reserved: number }>;
};

export function parseStockLevel(value: unknown): StockLevel {
  return value === "in" || value === "low" || value === "out" ? value : "all";
}

export function parseLocation(value: unknown): LocationFilter {
  return value === "TOR" || value === "MTL" ? value : "all";
}

// With both locations, a row matches if either location does, except "out
// of stock", which means out everywhere.
export function matchesStock(
  row: StockRow,
  level: StockLevel,
  location: LocationFilter,
  lowThreshold: number,
): boolean {
  if (level === "all") return true;
  const codes = location === "all" ? LOCATION_CODES : [location];
  const free = codes.map((code) => row.stock[code].onHand - row.stock[code].reserved);
  if (level === "out") return free.every((f) => f <= 0);
  if (level === "in") return free.some((f) => f > 0);
  return free.some((f) => f <= lowThreshold);
}

// ─── Cost and margin ────────────────────────────────────────────────────────

export type CostFilter = "all" | "review" | "nocost";

export type CostRow = {
  priceCents: number;
  stock: Record<
    "TOR" | "MTL",
    { onHand: number; avgCostCents: number | null; lastCostCents: number | null }
  >;
};

export type CostRules = { targetMarginPercent: number; costDriftPercent: number };

export function parseCostFilter(value: unknown): CostFilter {
  return value === "review" || value === "nocost" ? value : "all";
}

// Margin at one location, and whether it needs a look: margin under the
// target, or the last purchase cost far from the average.
export function costStatus(row: CostRow, code: "TOR" | "MTL", rules: CostRules) {
  const s = row.stock[code];
  const margin = marginPercent(row.priceCents, s.avgCostCents);
  const drift = driftPercent(s.lastCostCents, s.avgCostCents);
  return {
    margin,
    drift,
    lowMargin: margin !== null && margin < rules.targetMarginPercent,
    drifted: drift !== null && Math.abs(drift) >= rules.costDriftPercent,
  };
}

export function matchesCost(
  row: CostRow,
  filter: CostFilter,
  location: LocationFilter,
  rules: CostRules,
): boolean {
  if (filter === "all") return true;
  const codes = location === "all" ? LOCATION_CODES : [location];
  if (filter === "nocost") {
    return codes.some(
      (code) => row.stock[code].onHand > 0 && row.stock[code].avgCostCents === null,
    );
  }
  return codes.some((code) => {
    const status = costStatus(row, code, rules);
    return status.lowMargin || status.drifted;
  });
}
