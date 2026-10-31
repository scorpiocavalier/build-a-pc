import { CheckCircle2, Clock, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatOrderNumber } from "@/lib/checkout/order-number";
import { formatRate } from "@/lib/checkout/pricing";
import { formatDate } from "@/lib/checkout/windows";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { returnBlocker, returnWindowEnds } from "@/lib/returns/eligibility";
import { cn } from "@/lib/utils";
import { formatAddress, loadOrderForCustomer } from "@/server/orders/view";
import { getSettings } from "@/server/settings";

type Props = PageProps<"/[locale]/orders/[id]">;

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OrderPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <OrderContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderContent({ params, searchParams }: Props) {
  const [{ id }, query, locale, t, checkout] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations("Order"),
    getTranslations("Checkout"),
  ]);
  const cartT = await getTranslations("Cart");
  const token = typeof query.t === "string" ? query.t : "";
  const order = await loadOrderForCustomer(id, token);
  if (!order) {
    return <p className="rounded-lg border bg-surface p-6 text-muted">{t("notFound")}</p>;
  }
  const settings = await getSettings();
  const money = (cents: number) => formatMoney(cents, locale);
  const number = formatOrderNumber(order.number);
  const location = localize(order.location.name, locale);
  const owing = order.totalCents - order.paidCents;
  // Assembled builds: the part of the deposit still to pay before assembly.
  const depositOwing = Math.max(0, order.depositCents - order.paidCents);
  const justPlaced = order.status === "PLACED";
  const canReturn = returnBlocker(order, new Date()) === null;
  const returnsT = await getTranslations("Returns");
  const longDate = new Intl.DateTimeFormat(`${locale}-CA`, {
    dateStyle: "long",
    timeZone: "America/Toronto",
  });
  const lineName = new Map(order.lines.map((l) => [l.id, localize(l.name, locale)]));

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">{t("title", { number })}</p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          {order.status !== "CANCELLED" && (
            <CheckCircle2 aria-hidden="true" className="size-7 text-emerald-400" />
          )}
          {order.status === "CANCELLED"
            ? t("cancelled")
            : t("thanks", { name: order.name.split(" ")[0] })}
        </h1>
        {justPlaced && <p className="text-muted">{t("received", { email: order.email })}</p>}
        {typeof query.rma === "string" && (
          <p
            role="status"
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3"
          >
            {returnsT("sent", { rma: `RMA-${query.rma}`, email: order.email })}
          </p>
        )}
        <p className="text-sm text-muted">{t("keepLink")}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Badge label={t("statusLabel")} value={t(`status.${order.status}`)} />
        <Badge
          label={t("paymentLabel")}
          value={`${t(`paymentStatus.${order.paymentStatus}`)} · ${t(`method.${order.paymentMethod}`)}`}
        />
      </dl>

      {order.status === "PLACED" &&
        order.paymentMethod === "CARD" &&
        order.paymentStatus === "UNPAID" && <Notice icon>{t("cardProcessing")}</Notice>}

      {order.status !== "CANCELLED" &&
        (order.paymentMethod === "ETRANSFER" || depositOwing > 0) &&
        order.paymentMethod !== "CARD" &&
        owing > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-4">
            <h2 className="font-semibold">{t("etransferTitle")}</h2>
            <p>
              {!settings.etransferEmail
                ? t("etransferPending")
                : depositOwing > 0
                  ? t("etransferDeposit", {
                      amount: money(depositOwing),
                      total: money(owing),
                      email: settings.etransferEmail,
                      number,
                    })
                  : t("etransferSteps", {
                      amount: money(owing),
                      email: settings.etransferEmail,
                      number,
                    })}
            </p>
            {depositOwing > 0 && (
              <p className="text-sm">{t("assemblyNote", { days: settings.assemblyDays })}</p>
            )}
            {order.holdUntil && (
              <p className="text-sm">
                {t("payBy", {
                  deadline: new Intl.DateTimeFormat(`${locale}-CA`, {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/Toronto",
                  }).format(order.holdUntil),
                })}
              </p>
            )}
          </section>
        )}

      {order.status !== "CANCELLED" &&
        order.paymentMethod === "CASH" &&
        owing > 0 &&
        depositOwing === 0 && <Notice>{t("cashInfo", { amount: money(owing) })}</Notice>}

      <section className="flex flex-col gap-1 rounded-lg border bg-surface p-4">
        <p className="font-medium">
          {order.fulfilment === "PICKUP"
            ? t("fulfilmentPickup", { location })
            : t("fulfilmentDelivery", { address: formatAddress(order.deliveryAddress!) })}
        </p>
        {order.fulfilment === "PICKUP" && (
          <p className="text-sm text-muted">
            {t("pickupAddress", {
              address: localize(order.location.address, locale),
              hours: localize(order.location.hours, locale),
            })}
          </p>
        )}
        <p className="text-sm text-muted">
          {t("requested", {
            date: formatDate(order.requestedWindow.date, locale),
            slot: checkout(`slots.${order.requestedWindow.slot}`),
          })}{" "}
          {t("confirmTime")}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
        <h2 className="font-semibold">{t("items")}</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {order.lines.map((line, i) => (
            <li key={line.id} className="flex flex-col gap-1">
              {line.buildGroup && order.lines[i - 1]?.buildGroup !== line.buildGroup && (
                <span className="mt-1 text-xs font-semibold tracking-wide text-accent uppercase">
                  {cartT("assembledBuild")}
                </span>
              )}
              <span className={cn("flex justify-between gap-3", line.buildGroup && "pl-3")}>
                <span>
                  {line.quantity} × {localize(line.name, locale)}
                </span>
                <span className="tabular-nums">{money(line.unitPriceCents * line.quantity)}</span>
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t pt-3 text-sm">
          <Row label={checkout("subtotal")} value={money(order.subtotalCents)} />
          {order.assemblyCents > 0 && (
            <Row label={checkout("assembly")} value={money(order.assemblyCents)} />
          )}
          {order.fulfilment === "DELIVERY" && (
            <Row
              label={checkout("deliveryFee")}
              value={order.deliveryCents ? money(order.deliveryCents) : checkout("free")}
            />
          )}
          {order.taxBreakdown.map((tax) => (
            <Row
              key={tax.name}
              label={checkout("taxLine", { name: tax.name, rate: formatRate(tax.rate, locale) })}
              value={money(tax.cents)}
            />
          ))}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>{checkout("total")}</dt>
            <dd className="tabular-nums">{money(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {(order.returns.length > 0 || canReturn) && (
        <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <RotateCcw aria-hidden="true" className="size-4 text-accent" />
            {returnsT("sectionTitle")}
          </h2>
          {order.returns.map((request) => (
            <div key={request.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">RMA-{request.number}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {t(`returnStatus.${request.status}`)}
                </span>
                <span className="text-muted">{longDate.format(request.createdAt)}</span>
              </p>
              <ul className="text-muted">
                {request.lines.map((line) => (
                  <li key={line.id}>
                    {line.quantity} × {lineName.get(line.orderLineId)}
                  </li>
                ))}
              </ul>
              {request.adminNote && <p>{returnsT("storeNote", { note: request.adminNote })}</p>}
              {request.status === "APPROVED" && <p>{returnsT("approvedNext")}</p>}
            </div>
          ))}
          {canReturn && (
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href={`/orders/${order.id}/return?t=${order.accessToken}`}>
                  {returnsT("start")}
                </Link>
              </Button>
              <span className="text-sm text-muted">
                {returnsT("deadline", {
                  date: longDate.format(returnWindowEnds(order.completedAt!)),
                })}
              </span>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Notice({ children, icon }: { children: React.ReactNode; icon?: boolean }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border bg-surface p-4 text-sm")}>
      {icon && <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />}
      {children}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
