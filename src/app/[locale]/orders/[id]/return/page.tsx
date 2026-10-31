import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Link } from "@/i18n/navigation";
import { formatOrderNumber } from "@/lib/checkout/order-number";
import { localize } from "@/lib/localized";
import { returnBlocker, returnableQuantities, returnWindowEnds } from "@/lib/returns/eligibility";
import { loadOrderForReturn } from "@/server/returns";
import { getSettings } from "@/server/settings";

import { ReturnForm } from "./return-form";

type Props = PageProps<"/[locale]/orders/[id]/return">;

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ReturnPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <ReturnContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ReturnContent({ params, searchParams }: Props) {
  const [{ id }, query, locale, t, cart] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations("Returns"),
    getTranslations("Cart"),
  ]);
  const token = typeof query.t === "string" ? query.t : "";
  const order = await loadOrderForReturn(id);
  if (!order || order.accessToken !== token) {
    const orderT = await getTranslations("Order");
    return <p className="rounded-lg border bg-surface p-6 text-muted">{orderT("notFound")}</p>;
  }
  const settings = await getSettings();
  const orderLink = `/orders/${order.id}?t=${order.accessToken}`;
  const blocker = returnBlocker(order, new Date(), settings.returnWindowDays);
  const left = returnableQuantities(order);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href={orderLink} className="text-sm text-muted hover:text-foreground">
          ← {formatOrderNumber(order.number)}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      </div>
      <section className="flex flex-col gap-1 rounded-lg border bg-surface p-4 text-sm text-muted">
        <p>{t("policyWindow", { days: settings.returnWindowDays })}</p>
        <p>{t("policyAssembled")}</p>
        <p>{t("policyFee", { percent: settings.restockingPercent })}</p>
        <p>{t("policyWarranty")}</p>
      </section>
      {blocker ? (
        <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
          {t(`errors.${blocker}`)}
        </p>
      ) : (
        <>
          <p className="text-sm">
            {t("deadline", {
              date: new Intl.DateTimeFormat(`${locale}-CA`, {
                dateStyle: "long",
                timeZone: "America/Toronto",
              }).format(returnWindowEnds(order.completedAt!, settings.returnWindowDays)),
            })}
          </p>
          <ReturnForm
            locale={locale}
            orderId={order.id}
            token={token}
            lines={order.lines.map((line, i) => ({
              id: line.id,
              name: `${line.quantity} × ${localize(line.name, locale)}`,
              returnable: left[line.id] ?? 0,
              group:
                line.buildGroup && order.lines[i - 1]?.buildGroup !== line.buildGroup
                  ? cart("assembledBuild")
                  : null,
            }))}
          />
        </>
      )}
    </>
  );
}
