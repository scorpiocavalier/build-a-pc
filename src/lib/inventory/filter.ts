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
  const codes = location === "all" ? (["TOR", "MTL"] as const) : [location];
  const free = codes.map((code) => row.stock[code].onHand - row.stock[code].reserved);
  if (level === "out") return free.every((f) => f <= 0);
  if (level === "in") return free.some((f) => f > 0);
  return free.some((f) => f <= lowThreshold);
}
