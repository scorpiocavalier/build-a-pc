import { costStatus, type CostRules } from "@/lib/inventory/filter";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const money = (cents: number) => formatMoney(Math.round(cents), "en");
const percent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;

// One location's average cost and margin, flagged when the margin is under
// the target or the last purchase cost is far from the average.
export function CostCell({
  priceCents,
  avgCostCents,
  lastCostCents,
  rules,
}: {
  priceCents: number;
  avgCostCents: number | null;
  lastCostCents: number | null;
  rules: CostRules;
}) {
  if (avgCostCents === null) {
    return <td className="px-3 py-2 text-right text-muted tabular-nums">no cost</td>;
  }
  const s = { onHand: 0, avgCostCents, lastCostCents };
  const cost = costStatus({ priceCents, stock: { TOR: s, MTL: s } }, "TOR", rules);
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {money(avgCostCents)}
      {" · "}
      <span className={cn(cost.lowMargin && "font-semibold text-amber-300")}>
        {cost.margin === null ? "—" : `${cost.margin.toFixed(0)}%`}
      </span>
      {cost.drifted && (
        <span className="block text-xs text-amber-300">
          last paid {money(lastCostCents!)} ({percent(cost.drift!)})
        </span>
      )}
    </td>
  );
}
