import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { formatOrderNumber } from "@/lib/checkout/order-number";
import type { LocalizedText } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { parseRange, presets } from "@/lib/reports/range";
import { getReport } from "@/server/admin/reports";
import { requireAdmin } from "@/server/require-admin";

export const metadata = { title: "Reports" };
export const instant = false;

const money = (cents: number) => formatMoney(cents, "en");
const METHOD: Record<string, string> = { CARD: "Card", ETRANSFER: "e-Transfer", CASH: "Cash" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const params = await searchParams;
  const now = new Date();
  const range = parseRange(params.from, params.to, now);
  const location = params.location === "TOR" || params.location === "MTL" ? params.location : null;
  const report = await getReport(range, location);
  const quick = presets(now);
  const link = (r: { from: string; to: string }) =>
    `/admin/reports?from=${r.from}&to=${r.to}${location ? `&location=${location}` : ""}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-muted">
          {range.from === range.to ? range.from : `${range.from} to ${range.to}`}
          {location ? ` · ${location === "TOR" ? "Toronto" : "Montreal"}` : " · both locations"}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-2">
          <Field label="From" htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={range.from} className="w-40" />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={range.to} className="w-40" />
          </Field>
          <Field label="Location" htmlFor="location">
            <Select id="location" name="location" defaultValue={location ?? ""} className="w-40">
              <option value="">Both</option>
              <option value="TOR">Toronto</option>
              <option value="MTL">Montreal</option>
            </Select>
          </Field>
          <Button variant="outline">Show</Button>
        </form>
        <nav aria-label="Quick periods" className="flex gap-1 text-sm">
          {(
            [
              ["Today", quick.today],
              ["This month", quick.month],
              ["Last month", quick.lastMonth],
              ["This year", quick.year],
            ] as const
          ).map(([label, r]) => (
            <Link
              key={label}
              href={link(r)}
              className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-raised hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Money received" value={money(report.receivedCents)} />
        <Stat label="Refunded" value={money(report.refundedCents)} />
        <Stat label="Net" value={money(report.netCents)} />
        <Stat
          label="Orders placed"
          value={String(report.sales.orders)}
          note={`${money(report.sales.totalCents)} · avg ${money(report.sales.averageCents)}`}
        />
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Received by payment method">
          <Table
            head={["Method", "Location", "Payments", "Amount"]}
            rows={report.received.map((r) => [
              METHOD[r.method],
              r.code,
              String(r.count),
              money(r.cents),
            ])}
            empty="No payments in this period."
          />
          {report.refunded.length > 0 && (
            <Table
              head={["Refunded by", "Location", "Fees kept", "Amount"]}
              rows={report.refunded.map((r) => [
                METHOD[r.method],
                r.code,
                money(r.fees),
                money(r.cents),
              ])}
              empty=""
            />
          )}
        </Panel>

        <Panel title="Orders placed (not cancelled)">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Orders</dt>
            <dd className="text-right tabular-nums">{report.sales.orders}</dd>
            <dt className="text-muted">With an assembled PC</dt>
            <dd className="text-right tabular-nums">{report.sales.assembled}</dd>
            <dt className="text-muted">Order value (incl. tax)</dt>
            <dd className="text-right tabular-nums">{money(report.sales.totalCents)}</dd>
            <dt className="text-muted">Tax charged</dt>
            <dd className="text-right tabular-nums">{money(report.sales.taxCents)}</dd>
            <dt className="text-muted">Restocking fees kept</dt>
            <dd className="text-right tabular-nums">{money(report.feesCents)}</dd>
          </dl>
        </Panel>

        <Panel title="Top products">
          <Table
            head={["Product", "Units", "Sales"]}
            rows={report.topProducts.map((p) => [
              <span key="n">
                {(p.name as LocalizedText | null)?.en ?? p.sku}{" "}
                <span className="font-mono text-xs text-muted">{p.sku}</span>
              </span>,
              String(p.units),
              money(p.cents),
            ])}
            empty="No sales in this period."
          />
        </Panel>

        <Panel title="Stock on hand now (at selling price)">
          <Table
            head={["Location", "Units", "Value"]}
            rows={report.stockValue.map((r) => [r.code, String(r.units), money(r.cents)])}
            empty="No stock."
          />
        </Panel>

        <Panel title="Deposits paid, balance owing">
          <Table
            head={["Order", "Customer", "Paid", "Owing"]}
            rows={report.awaitingBalance.map((o) => [
              <Link key="o" href={`/admin/orders/${o.id}`} className="hover:text-accent">
                {formatOrderNumber(o.number)}{" "}
                <span className="text-xs text-muted">{o.location.code}</span>
              </Link>,
              o.name,
              money(o.paidCents),
              money(o.totalCents - o.paidCents),
            ])}
            empty="No open balances."
          />
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border bg-surface p-5">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted">{label}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </li>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-lg border bg-surface/60 p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted">
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              className={i === head.length - 1 ? "py-1 text-right font-medium" : "py-1 font-medium"}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td
                key={i}
                className={i === row.length - 1 ? "py-1.5 text-right tabular-nums" : "py-1.5"}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
