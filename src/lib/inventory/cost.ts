// Moving weighted average cost, landed-cost allocation and margins.
// Money is in cents; costs may be fractional cents.

export type CostSplit = "VALUE" | "UNITS";

// New average after receiving `quantity` units at `unitCost`. Units already
// on hand with no known cost are assumed to cost the same as the new ones.
export function weightedAverage(
  onHand: number,
  avgCost: number | null,
  quantity: number,
  unitCost: number,
): number {
  if (avgCost === null || onHand <= 0) return unitCost;
  return (onHand * avgCost + quantity * unitCost) / (onHand + quantity);
}

// Spreads shipping, duties and fees over the lines, returning each line's
// landed cost per unit. By value: a $500 GPU carries more shipping than a
// $10 cable. By units: every unit carries the same share.
export function landedUnitCosts(
  lines: { quantity: number; unitCostCents: number }[],
  extraCents: number,
  split: CostSplit,
): number[] {
  const totalValue = lines.reduce((s, l) => s + l.quantity * l.unitCostCents, 0);
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  // Free items can't take a share by value; fall back to units.
  const byUnits = split === "UNITS" || totalValue === 0;
  return lines.map((l) => {
    if (extraCents === 0 || totalUnits === 0) return l.unitCostCents;
    const share = byUnits
      ? (extraCents * l.quantity) / totalUnits
      : (extraCents * l.quantity * l.unitCostCents) / totalValue;
    return l.unitCostCents + share / l.quantity;
  });
}

// Share of the selling price kept after cost, as a percentage.
export function marginPercent(priceCents: number, costCents: number | null): number | null {
  if (costCents === null || priceCents <= 0) return null;
  return ((priceCents - costCents) / priceCents) * 100;
}

// How far the latest purchase was from the average, as a percentage.
export function driftPercent(lastCost: number | null, avgCost: number | null): number | null {
  if (lastCost === null || avgCost === null || avgCost <= 0) return null;
  return ((lastCost - avgCost) / avgCost) * 100;
}
