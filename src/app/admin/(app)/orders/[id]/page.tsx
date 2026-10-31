import Link from "next/link";
import { notFound } from "next/navigation";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import { nextStatuses } from "@/lib/checkout/order-status";
import { formatDate } from "@/lib/checkout/windows";
import { formatMoney } from "@/lib/money";
import { dateToStoreParts } from "@/lib/store-time";
import { cn } from "@/lib/utils";
import { getAdminOrder } from "@/server/admin/orders";
import { formatAddress, orderUrl } from "@/server/orders/view";
import { stripeEnabled } from "@/server/settings";

import { STATUS_STYLE } from "../status-style";
import {
  BalanceLinkButton,
  CancelOrderForm,
  RecordPaymentForm,
  ScheduleForm,
  StatusButton,
} from "../order-actions";

export const metadata = { title: "Order" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const SLOT_LABEL = {
  morning: "morning (10–1)",
  afternoon: "afternoon (1–5)",
  evening: "evening (5–8)",
};
const SLOT_START = { morning: "10:00", afternoon: "13:00", evening: "17:00" };
const dateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(d);

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const money = (cents: number) => formatMoney(cents, "en");
  const owing = order.totalCents - order.paidCents;
  const next = nextStatuses(order).filter((s) => s !== "CANCELLED") as Exclude<
    (typeof order)["status"],
    "CANCELLED"
  >[];
  const open = order.status !== "COMPLETED" && order.status !== "CANCELLED";
  const cardPaid = order.payments.some((p) => p.method === "CARD" && p.status === "SUCCEEDED");
  const offlinePaidCents = order.payments
    .filter((p) => p.method !== "CARD" && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm text-muted hover:text-foreground">
            ← Orders
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold">
            {formatOrderNumber(order.number)}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-normal",
                STATUS_STYLE[order.status],
              )}
            >
              {order.status.toLowerCase().replaceAll("_", " ")}
            </span>
          </h1>
          <p className="text-sm text-muted">
            Placed {dateTime(order.placedAt)} · {order.locale.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          {order.assemblyCents > 0 && (
            <Link
              href={`/admin/orders/${order.id}/build-sheet`}
              className="text-accent hover:underline"
            >
              Build sheet
            </Link>
          )}
          <a href={orderUrl(order)} target="_blank" className="text-accent hover:underline">
            Customer&apos;s order page ↗
          </a>
        </div>
      </div>

      {order.status === "CANCELLED" && (
        <p className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
          Cancelled: {order.cancelReason}
        </p>
      )}

      {open &&
        (next.length > 0 ||
          order.status === "PLACED" ||
          order.status === "READY" ||
          order.status === "OUT_FOR_DELIVERY") && (
          <section className="flex flex-col gap-3 rounded-lg border bg-surface/60 p-5">
            <h2 className="font-semibold">Next step</h2>
            <div className="flex flex-wrap gap-3">
              {next.map((to) => (
                <StatusButton key={to} orderId={order.id} to={to} />
              ))}
            </div>
            {order.status === "PLACED" && order.paidCents < order.depositCents && (
              <p className="text-sm text-amber-300">
                Waiting for the {money(order.depositCents)} deposit before assembly can start.
              </p>
            )}
            {(order.status === "READY" || order.status === "OUT_FOR_DELIVERY") &&
              order.paymentStatus !== "PAID" && (
                <p className="text-sm text-amber-300">
                  Record the full payment before marking it completed.
                </p>
              )}
          </section>
        )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-lg border bg-surface/60 p-5 text-sm">
          <h2 className="mb-1 font-semibold">Customer</h2>
          <p>{order.name}</p>
          <p>
            <a href={`mailto:${order.email}`} className="text-accent hover:underline">
              {order.email}
            </a>{" "}
            ·{" "}
            <a href={`tel:${order.phone}`} className="text-accent hover:underline">
              {order.phone}
            </a>
          </p>
          <h2 className="mt-3 mb-1 font-semibold">
            {order.fulfilment === "PICKUP" ? "Pickup" : "Delivery"} · {order.location.name.en}
          </h2>
          {order.deliveryAddress && <p>{formatAddress(order.deliveryAddress)}</p>}
          <p>
            Requested {formatDate(order.requestedWindow.date, "en")},{" "}
            {SLOT_LABEL[order.requestedWindow.slot]}
          </p>
          {order.scheduledFor && (
            <p className="font-medium text-accent">Booked for {dateTime(order.scheduledFor)}</p>
          )}
          {open && (
            <ScheduleForm
              orderId={order.id}
              booked={!!order.scheduledFor}
              {...(order.scheduledFor
                ? dateToStoreParts(order.scheduledFor)
                : {
                    date: order.requestedWindow.date,
                    time: SLOT_START[order.requestedWindow.slot],
                  })}
            />
          )}
          {order.notes && (
            <p className="rounded border bg-background p-2 whitespace-pre-line">{order.notes}</p>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-lg border bg-surface/60 p-5 text-sm">
          <h2 className="mb-1 font-semibold">Items</h2>
          <ul className="flex flex-col gap-1">
            {order.lines.map((line, i) => (
              <li key={line.id} className="flex flex-col">
                {line.buildGroup && order.lines[i - 1]?.buildGroup !== line.buildGroup && (
                  <span className="mt-1 text-xs font-semibold tracking-wide text-accent uppercase">
                    Assembled PC
                  </span>
                )}
                <span className={cn("flex justify-between gap-3", line.buildGroup && "pl-3")}>
                  <span>
                    {line.quantity} × {line.name.en}{" "}
                    <span className="font-mono text-xs text-muted">{line.sku}</span>
                  </span>
                  <span className="tabular-nums">{money(line.unitPriceCents * line.quantity)}</span>
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 flex flex-col gap-1 border-t pt-2">
            <Row label="Subtotal" value={money(order.subtotalCents)} />
            {order.assemblyCents > 0 && <Row label="Assembly" value={money(order.assemblyCents)} />}
            {order.fulfilment === "DELIVERY" && (
              <Row label="Delivery" value={money(order.deliveryCents)} />
            )}
            {order.taxBreakdown.map((tax) => (
              <Row
                key={tax.name}
                label={`${tax.name} ${tax.rate / 1000}%`}
                value={money(tax.cents)}
              />
            ))}
            <Row label="Total" value={money(order.totalCents)} strong />
            {order.depositCents > 0 && (
              <Row label="Deposit required" value={money(order.depositCents)} />
            )}
            <Row label="Paid" value={money(order.paidCents)} />
            {order.refundedCents > 0 && (
              <Row label="Refunded (returns)" value={`−${money(order.refundedCents)}`} />
            )}
            {owing > 0 && order.status !== "CANCELLED" && (
              <Row label="Owing" value={money(owing)} strong />
            )}
          </dl>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border bg-surface/60 p-5">
        <h2 className="font-semibold">Payments · {order.paymentMethod.toLowerCase()} order</h2>
        {order.payments.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {order.payments.map((p) => (
              <li key={p.id}>
                {p.method.toLowerCase()} · {money(p.amountCents)} · {p.status.toLowerCase()}
                {p.reference ? ` · ${p.reference}` : ""}
                {p.receivedAt ? ` · ${dateTime(p.receivedAt)}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No payments yet.</p>
        )}
        {order.refunds.length > 0 && (
          <>
            <h3 className="text-sm font-semibold">Refunds</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {order.refunds.map((r) => (
                <li key={r.id}>
                  {r.method.toLowerCase()} · −{money(r.amountCents)} · {r.reason}
                  {r.restockingFeeCents ? ` · fee ${money(r.restockingFeeCents)}` : ""} ·{" "}
                  {dateTime(r.createdAt)}
                </li>
              ))}
            </ul>
          </>
        )}
        {open && owing > 0 && stripeEnabled() && (
          <BalanceLinkButton orderId={order.id} amount={money(owing)} />
        )}
        {open && owing > 0 && order.paymentMethod !== "CARD" && (
          <RecordPaymentForm
            orderId={order.id}
            owingDollars={(owing / 100).toFixed(2)}
            defaultMethod={order.paymentMethod}
          />
        )}
        {order.holdUntil && order.status === "PLACED" && (
          <p className="text-sm text-amber-300">
            Cancels automatically if unpaid by {dateTime(order.holdUntil)}. Confirming the order
            keeps it.
          </p>
        )}
      </section>

      {order.returns.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border bg-surface/60 p-5 text-sm">
          <h2 className="mb-1 font-semibold">Returns</h2>
          <ul className="flex flex-col gap-1">
            {order.returns.map((request) => (
              <li key={request.id}>
                <Link href="/admin/returns?show=all" className="text-accent hover:underline">
                  RMA-{request.number}
                </Link>{" "}
                · {request.status.toLowerCase()} · {request.reason.toLowerCase().replace(/_/g, " ")}{" "}
                ·{" "}
                {request.lines
                  .map((line) => {
                    const orderLine = order.lines.find((l) => l.id === line.orderLineId);
                    return `${line.quantity} × ${orderLine?.name.en ?? "?"}`;
                  })
                  .join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-lg border bg-surface/60 p-5 text-sm">
        <h2 className="mb-1 font-semibold">Timeline</h2>
        <ol className="flex flex-col gap-1">
          {order.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-40 shrink-0 text-muted">{dateTime(e.createdAt)}</span>
              <span>
                {e.type.replace("status:", "→ ").toLowerCase()}
                {e.message ? ` · ${e.message}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {open && (
        <section className="rounded-lg border border-red-400/30 bg-surface/60 p-5">
          <h2 className="mb-3 font-semibold">Cancel order</h2>
          <CancelOrderForm
            orderId={order.id}
            willRefund={cardPaid}
            offlinePaid={offlinePaidCents > 0 ? money(offlinePaidCents) : null}
          />
        </section>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "font-semibold")}>
      <dt className={strong ? undefined : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
