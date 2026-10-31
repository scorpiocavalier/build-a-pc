import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { LOCATION_CODES, type LocationCode } from "@/lib/catalog/product-input";
import { normalizePostalCode } from "@/lib/checkout/postal";
import { formatRate } from "@/lib/checkout/pricing";
import { availableDates, formatDate } from "@/lib/checkout/windows";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { getCartLines, type CartLineView } from "@/server/cart";
import {
  quoteCheckout,
  type CheckoutQuote,
  type FulfilmentChoice,
} from "@/server/orders/lifecycle";
import { getSettings } from "@/server/settings";

import { CheckoutForm } from "./checkout-form";

type Props = PageProps<"/[locale]/checkout">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Checkout");
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ searchParams }: Props) {
  const t = await getTranslations("Checkout");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <CheckoutContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function CheckoutContent({ searchParams }: Pick<Props, "searchParams">) {
  const [params, lines, locale, t] = await Promise.all([
    searchParams,
    getCartLines(),
    getLocale(),
    getTranslations("Checkout"),
  ]);
  if (lines.length === 0) redirect(`/${locale}/cart`);

  // Step 1 is a plain GET form, so it works without JavaScript and the
  // chosen option stays in the URL.
  const kind = one(params.f);
  let choice: FulfilmentChoice | null = null;
  let postalError: string | null = null;
  if (kind === "pickup" && (LOCATION_CODES as readonly string[]).includes(one(params.l))) {
    choice = { kind: "PICKUP", locationCode: one(params.l) as LocationCode };
  } else if (kind === "delivery") {
    const postalCode = normalizePostalCode(one(params.pc));
    if (postalCode) choice = { kind: "DELIVERY", postalCode };
    else postalError = t("invalidPostal");
  }

  const quoted = choice ? await quoteCheckout(lines, choice) : null;
  if (quoted && "error" in quoted && choice?.kind === "DELIVERY") {
    postalError = t("noDelivery", { postalCode: choice.postalCode });
  }
  const ready = quoted && !("error" in quoted) ? quoted : null;

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-8">
        <FulfilmentStep
          current={choice}
          postalInput={one(params.pc)}
          postalError={postalError}
          locationLabel={ready ? localize(ready.location.name, locale) : null}
        />
        {ready && choice && (
          <DetailsStep choice={choice} quoted={ready} lines={lines} locale={locale} />
        )}
      </div>
      <OrderSummary lines={lines} quoted={ready} locale={locale} />
    </div>
  );
}

async function FulfilmentStep({
  current,
  postalInput,
  postalError,
  locationLabel,
}: {
  current: FulfilmentChoice | null;
  postalInput: string;
  postalError: string | null;
  locationLabel: string | null;
}) {
  const [t, catalog] = await Promise.all([getTranslations("Checkout"), getTranslations("Catalog")]);

  if (current && locationLabel) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-4">
        <p className="font-medium">
          {current.kind === "PICKUP"
            ? t("pickupAt", { location: locationLabel })
            : t("deliveryFrom", { location: locationLabel, postalCode: current.postalCode })}
        </p>
        <Link href="/checkout" className="text-sm text-accent hover:underline">
          {t("change")}
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("fulfilmentTitle")}</h2>
      <form className="flex flex-col gap-3">
        <input type="hidden" name="f" value="pickup" />
        {LOCATION_CODES.map((code) => (
          <Button key={code} name="l" value={code} variant="outline" className="justify-start">
            {t("pickupAt", { location: catalog(`locations.${code}`) })}
          </Button>
        ))}
      </form>
      <form className="flex flex-col gap-2 rounded-lg border bg-surface p-4">
        <input type="hidden" name="f" value="delivery" />
        <label htmlFor="pc" className="font-medium">
          {t("delivery")}
        </label>
        <p className="text-sm text-muted">{t("deliveryHint")}</p>
        <div className="flex gap-2">
          <Input
            id="pc"
            name="pc"
            defaultValue={postalInput}
            placeholder="M5V 3L9"
            autoComplete="postal-code"
            aria-label={t("postalCode")}
            aria-invalid={postalError ? true : undefined}
            className="max-w-40 uppercase"
          />
          <Button variant="outline">{t("checkDelivery")}</Button>
        </div>
        {postalError && (
          <p role="alert" className="text-sm text-red-300">
            {postalError}
          </p>
        )}
      </form>
    </section>
  );
}

async function DetailsStep({
  choice,
  quoted,
  lines,
  locale,
}: {
  choice: FulfilmentChoice;
  quoted: CheckoutQuote;
  lines: CartLineView[];
  locale: string;
}) {
  const [t, settings] = await Promise.all([getTranslations("Checkout"), getSettings()]);
  const location = localize(quoted.location.name, locale);

  if (quoted.shortages.length) {
    return (
      <section
        role="alert"
        className="flex flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4"
      >
        <p className="font-medium">{t("notEnoughStock", { location })}</p>
        <ul className="list-inside list-disc text-sm">
          {lines
            .filter((l) => quoted.shortages.includes(l.productId))
            .map((l) => (
              <li key={l.productId}>{localize(l.name, locale)}</li>
            ))}
        </ul>
        <p className="text-sm">
          {t("tryOther")}{" "}
          <Link href="/cart" className="text-accent hover:underline">
            {t("change")}
          </Link>
        </p>
      </section>
    );
  }

  const dates = availableDates(new Date()).map((value) => ({
    value,
    label: formatDate(value, locale),
  }));
  const cashLimitNote = quoted.methods.includes("CASH")
    ? null
    : t("cashLimit", { amount: formatMoney(settings.cashMaxCents, locale) });

  return (
    <CheckoutForm
      locale={locale}
      fulfilment={choice.kind}
      locationCode={quoted.location.code}
      postalCode={choice.kind === "DELIVERY" ? choice.postalCode : ""}
      dates={dates}
      methods={quoted.methods}
      etransferHours={settings.etransferHoldHours}
      cashLimitNote={cashLimitNote}
    />
  );
}

async function OrderSummary({
  lines,
  quoted,
  locale,
}: {
  lines: CartLineView[];
  quoted: CheckoutQuote | null;
  locale: string;
}) {
  const t = await getTranslations("Checkout");
  const money = (cents: number) => formatMoney(cents, locale);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

  return (
    <aside
      aria-label={t("summary")}
      className="flex h-fit flex-col gap-3 rounded-lg border bg-surface p-5 md:sticky md:top-20"
    >
      <h2 className="font-semibold">{t("summary")}</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {lines.map((line) => (
          <li key={line.productId} className="flex justify-between gap-3">
            <span>
              {line.quantity} × {localize(line.name, locale)}
            </span>
            <span className="tabular-nums">{money(line.unitPriceCents * line.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 border-t pt-3 text-sm">
        <Row label={t("subtotal")} value={money(subtotal)} />
        {quoted && quoted.quote.deliveryCents > 0 && (
          <Row label={t("deliveryFee")} value={money(quoted.quote.deliveryCents)} />
        )}
        {quoted?.quote.taxes.map((tax) => (
          <Row
            key={tax.name}
            label={t("taxLine", { name: tax.name, rate: formatRate(tax.rate, locale) })}
            value={money(tax.cents)}
          />
        ))}
      </dl>
      <div className="flex justify-between border-t pt-3 text-lg font-semibold">
        <span>{t("total")}</span>
        <span className="tabular-nums">{money(quoted ? quoted.quote.totalCents : subtotal)}</span>
      </div>
    </aside>
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
