import Link from "next/link";
import type { ReactNode } from "react";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import type { RequestedWindow } from "@/lib/checkout/windows";
import type { LocalizedText } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getAdminDashboard } from "@/server/admin/products";
import { getToday, type TodayOrder } from "@/server/admin/today";
import { requireAdmin } from "@/server/require-admin";

export const metadata = { title: "Today" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: "America/Toronto" });
const dateTime = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});
const money = (cents: number) => formatMoney(cents, "en");

export default async function TodayPage({ searchParams }: PageProps<"/admin">) {
  const { location: raw } = await searchParams;
  const location = raw === "TOR" || raw === "MTL" ? raw : null;
  const [user, today, stats] = await Promise.all([
    requireAdmin(),
    getToday(location),
    getAdminDashboard(),
  ]);

  const counts = [
    { label: "Awaiting payment or confirmation", value: today.counts.placed, status: "PLACED" },
    { label: "To prepare or assemble", value: today.counts.toPrepare, status: "CONFIRMED" },
    { label: "Ready / out for delivery", value: today.counts.ready, status: "READY" },
  ];
  const catalog = [
    { label: "Active products", value: stats.active, href: "/admin/products?status=ACTIVE" },
    { label: "Drafts", value: stats.drafts, href: "/admin/products?status=DRAFT" },
    { label: "Missing French", value: stats.missingFrench, href: "/admin/products?missing=fr" },
    {
      label: "Out of stock everywhere",
      value: stats.outOfStock,
      href: "/admin/products?stock=out",
    },
  ];
  const locationQuery = location ? `&location=${location}` : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="text-muted">
            Hi {user.name ?? user.email}. Here&apos;s what needs attention
            {location ? ` in ${location === "TOR" ? "Toronto" : "Montreal"}` : ""}.
          </p>
        </div>
        <nav aria-label="Location" className="flex gap-1 text-sm">
          {[
            { code: null, label: "Both" },
            { code: "TOR", label: "Toronto" },
            { code: "MTL", label: "Montreal" },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.code ? `/admin?location=${l.code}` : "/admin"}
              aria-current={location === l.code ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5",
                location === l.code ? "bg-surface-raised" : "text-muted hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {counts.map((card) => (
          <li key={card.label}>
            <Link
              href={`/admin/orders?status=${card.status}${locationQuery}`}
              className="flex flex-col gap-1 rounded-lg border bg-surface p-5 hover:border-accent/60"
            >
              <span className="text-3xl font-semibold">{card.value}</span>
              <span className="text-sm text-muted">{card.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Booked for today" empty="Nothing booked today.">
          {today.scheduledToday.map((o) => (
            <OrderRow key={o.id} order={o}>
              {time.format(o.scheduledFor!)} · {o.fulfilment === "PICKUP" ? "pickup" : "delivery"}
              {o.paidCents < o.totalCents && (
                <span className="text-amber-300"> · {money(o.totalCents - o.paidCents)} owing</span>
              )}
            </OrderRow>
          ))}
        </Panel>

        <Panel title="Payments to check" empty="No payments waiting.">
          {today.toConfirm.map((o) => (
            <OrderRow key={o.id} order={o}>
              {o.paymentMethod === "ETRANSFER" ? "e-Transfer" : "cash"} ·{" "}
              {o.depositCents > o.paidCents
                ? `deposit ${money(o.depositCents - o.paidCents)}`
                : money(o.totalCents - o.paidCents)}
              {o.holdUntil && <> · expires {dateTime.format(o.holdUntil)}</>}
            </OrderRow>
          ))}
        </Panel>

        <Panel title="PCs to assemble" empty="No builds waiting.">
          {today.toAssemble.map((o) => (
            <OrderRow key={o.id} order={o}>
              {o.status === "ASSEMBLING" ? "in progress" : "ready to start"}
              {o.scheduledFor && <> · due {dateTime.format(o.scheduledFor)}</>}
            </OrderRow>
          ))}
        </Panel>

        <Panel title="Needs a pickup or delivery time" empty="Everything is booked.">
          {today.unscheduled.map((o) => {
            const window = o.requestedWindow as RequestedWindow;
            return (
              <OrderRow key={o.id} order={o}>
                {o.fulfilment === "PICKUP" ? "pickup" : "delivery"} · asked for {window.date}{" "}
                {window.slot}
              </OrderRow>
            );
          })}
        </Panel>

        <Panel title="Returns" empty={null}>
          <li className="flex justify-between gap-3 py-2">
            <Link href="/admin/returns" className="hover:text-accent">
              Requests to review
            </Link>
            <span className="tabular-nums">{today.returns.toReview}</span>
          </li>
          <li className="flex justify-between gap-3 py-2">
            <Link href="/admin/returns?show=approved" className="hover:text-accent">
              Approved, waiting for the items
            </Link>
            <span className="tabular-nums">{today.returns.toReceive}</span>
          </li>
        </Panel>

        <Panel
          title={`Low stock (${today.lowStockThreshold} or fewer available)`}
          empty="Stock levels are fine."
        >
          {today.lowStock.slice(0, 12).map((row) => (
            <li
              key={`${row.product.id}-${row.location.code}`}
              className="flex justify-between gap-3 py-2"
            >
              <Link
                href={`/admin/inventory?q=${encodeURIComponent(row.product.sku)}`}
                className="hover:text-accent"
              >
                {(row.product.name as LocalizedText).en}{" "}
                <span className="text-xs text-muted">{row.location.code}</span>
              </Link>
              <span className={cn("tabular-nums", row.available <= 0 && "text-red-300")}>
                {row.available}
              </span>
            </li>
          ))}
        </Panel>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Catalog</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.map((card) => (
            <li key={card.label}>
              <Link
                href={card.href}
                className="flex flex-col gap-1 rounded-lg border bg-surface p-5 hover:border-accent/60"
              >
                <span className="text-3xl font-semibold">{card.value}</span>
                <span className="text-sm text-muted">{card.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: ReactNode[] | ReactNode;
}) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-lg border bg-surface/60 p-5">
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 && empty ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">{children}</ul>
      )}
    </section>
  );
}

function OrderRow({ order, children }: { order: TodayOrder; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-2">
      <Link href={`/admin/orders/${order.id}`} className="font-medium hover:text-accent">
        {formatOrderNumber(order.number)}
      </Link>
      <span>{order.name}</span>
      <span className="text-xs text-muted">{order.location.code}</span>
      <span className="w-full text-muted">{children}</span>
    </li>
  );
}
