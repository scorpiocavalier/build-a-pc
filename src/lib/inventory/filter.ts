import { driftPercent, marginPercent } from "./cost";

// Inventory page filters that depend on stock numbers, applied after the
// database query. "Free" = on hand − reserved for open orders.

export type StockLevel = "all" | "in" | "low" | "out";

export type StockRow = {
  stock: { onHand: number; reserved: number };
};

export function parseStockLevel(value: unknown): StockLevel {
  return value === "in" || value === "low" || value === "out" ? value : "all";
}

export function matchesStock(row: StockRow, level: StockLevel, lowThreshold: number): boolean {
  if (level === "all") return true;
  const free = row.stock.onHand - row.stock.reserved;
  if (level === "out") return free <= 0;
  if (level === "in") return free > 0;
  return free <= lowThreshold;
}

// ─── Cost and margin ────────────────────────────────────────────────────────

export type CostFilter = "all" | "review" | "nocost";

export type CostRow = {
  priceCents: number;
  stock: { onHand: number; avgCostCents: number | null; lastCostCents: number | null };
};

export type CostRules = { targetMarginPercent: number; costDriftPercent: number };

export function parseCostFilter(value: unknown): CostFilter {
  return value === "review" || value === "nocost" ? value : "all";
}

// The margin, and whether it needs a look: margin under the target, or the
// last purchase cost far from the average.
export function costStatus(row: CostRow, rules: CostRules) {
  const s = row.stock;
  const margin = marginPercent(row.priceCents, s.avgCostCents);
  const drift = driftPercent(s.lastCostCents, s.avgCostCents);
  return {
    margin,
    drift,
    lowMargin: margin !== null && margin < rules.targetMarginPercent,
    drifted: drift !== null && Math.abs(drift) >= rules.costDriftPercent,
  };
}

export function matchesCost(row: CostRow, filter: CostFilter, rules: CostRules): boolean {
  if (filter === "all") return true;
  if (filter === "nocost") return row.stock.onHand > 0 && row.stock.avgCostCents === null;
  const status = costStatus(row, rules);
  return status.lowMargin || status.drifted;
}
