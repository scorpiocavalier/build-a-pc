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
import { listAddresses, type SavedAddress } from "@/server/account/addresses";
import { getCheckoutCart, type CartLineView } from "@/server/cart";
import { getCustomer, getCustomerProfile } from "@/server/customer";
import { db } from "@/server/db";
import {
  quoteCheckout,
  type CheckoutCart,
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
  const [params, cart, locale, t] = await Promise.all([
    searchParams,
    getCheckoutCart(),
    getLocale(),
    getTranslations("Checkout"),
  ]);
  if (cart.lines.length === 0 && cart.builds.length === 0) redirect(`/${locale}/cart`);
  const account = await loadAccountDetails();

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

  const quoted = choice ? await quoteCheckout(cart, choice) : null;
  if (quoted && "error" in quoted && quoted.error === "noDelivery" && choice?.kind === "DELIVERY") {
    postalError = t("noDelivery", { postalCode: choice.postalCode });
  }
  // The Windows licence for assembled builds is no longer for sale.
  const windowsMissing = quoted && "error" in quoted && quoted.error === "windows";
  const ready = quoted && !("error" in quoted) ? quoted : null;

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-8">
        <FulfilmentStep
          current={choice}
          postalInput={one(params.pc) || account?.addresses[0]?.postalCode || ""}
          postalError={postalError}
          locationLabel={ready ? localize(ready.location.name, locale) : null}
        />
        {windowsMissing && (
          <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
            {t("errors.stock")}
          </p>
        )}
        {ready && choice && (
          <DetailsStep
            choice={choice}
            quoted={ready}
            cart={cart}
            locale={locale}
            account={account}
          />
        )}
      </div>
      <OrderSummary cart={cart} quoted={ready} locale={locale} />
    </div>
  );
}

type AccountDetails = {
  name: string;
  email: string;
  phone: string;
  // Default first.
  addresses: SavedAddress[];
};

// Signed-in customers get their details filled in.
async function loadAccountDetails(): Promise<AccountDetails | null> {
  const customer = await getCustomer();
  if (!customer) return null;
  const [profile, addresses, lastOrder] = await Promise.all([
    getCustomerProfile(customer.id),
    listAddresses(customer.id),
    db.order.findFirst({
      where: { userId: customer.id },
      orderBy: { placedAt: "desc" },
      select: { name: true, phone: true },
    }),
  ]);
  return {
    name: profile?.name || lastOrder?.name || addresses[0]?.name || "",
    email: profile?.email ?? customer.email,
    phone: addresses[0]?.phone || lastOrder?.phone || "",
    addresses,
  };
}

function prefillFor(account: AccountDetails | null, choice: FulfilmentChoice) {
  if (!account) return {};
  const values: Record<string, string> = {
    name: account.name,
    email: account.email,
    phone: account.phone,
  };
  const address =
    choice.kind === "DELIVERY"
      ? account.addresses.find((a) => a.postalCode === choice.postalCode)
      : undefined;
  if (address) {
    Object.assign(values, {
      addressId: address.id,
      name: address.name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
    });
  }
  return values;
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
        <Link href="/checkout" className="text-sm text-accent underline underline-offset-2">
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

// Every product line in the cart, including the parts of assembled builds.
function allLines(cart: CheckoutCart): CartLineView[] {
  return [
    ...cart.lines,
    ...cart.builds.flatMap((b) => [...b.parts, ...(b.windows ? [b.windows] : [])]),
  ];
}

async function DetailsStep({
  choice,
  quoted,
  cart,
  locale,
  account,
}: {
  choice: FulfilmentChoice;
  quoted: CheckoutQuote;
  cart: CheckoutCart;
  locale: string;
  account: AccountDetails | null;
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
          {[...new Map(allLines(cart).map((l) => [l.productId, l])).values()]
            .filter((l) => quoted.shortages.includes(l.productId))
            .map((l) => (
              <li key={l.productId}>{localize(l.name, locale)}</li>
            ))}
        </ul>
        <p className="text-sm">
          {t("tryOther")}{" "}
          <Link href="/cart" className="text-accent underline underline-offset-2">
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
      prefill={prefillFor(account, choice)}
      returnDays={settings.returnWindowDays}
      restockingPercent={settings.restockingPercent}
      signedIn={!!account}
      depositNote={
        quoted.depositCents > 0
          ? {
              general: t("deposit", {
                amount: formatMoney(quoted.depositCents, locale),
                percent: settings.depositPercent,
              }),
              CASH: t("depositCash", { amount: formatMoney(quoted.depositCents, locale) }),
              ETRANSFER: t("depositEtransfer", {
                amount: formatMoney(quoted.depositCents, locale),
              }),
            }
          : null
      }
    />
  );
}

async function OrderSummary({
  cart,
  quoted,
  locale,
}: {
  cart: CheckoutCart;
  quoted: CheckoutQuote | null;
  locale: string;
}) {
  const [t, cartT] = await Promise.all([getTranslations("Checkout"), getTranslations("Cart")]);
  const money = (cents: number) => formatMoney(cents, locale);
  const subtotal = allLines(cart).reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const lineItem = (line: CartLineView, key: string) => (
    <li key={key} className="flex justify-between gap-3">
      <span>
        {line.quantity} × {localize(line.name, locale)}
      </span>
      <span className="tabular-nums">{money(line.unitPriceCents * line.quantity)}</span>
    </li>
  );

  return (
    <aside
      aria-label={t("summary")}
      className="flex h-fit flex-col gap-3 rounded-lg border bg-surface p-5 md:sticky md:top-20"
    >
      <h2 className="font-semibold">{t("summary")}</h2>
      {cart.builds.map((build) => (
        <div key={build.id} className="flex flex-col gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">{cartT("assembledBuild")}</p>
          <ul className="flex flex-col gap-1.5 text-xs text-muted">
            {build.parts.map((part) => lineItem(part, `${build.id}-${part.productId}`))}
            {build.windows && lineItem(build.windows, `${build.id}-windows`)}
          </ul>
        </div>
      ))}
      {cart.lines.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {cart.lines.map((line) => lineItem(line, line.productId))}
        </ul>
      )}
      <dl className="flex flex-col gap-1 border-t pt-3 text-sm">
        <Row label={t("subtotal")} value={money(subtotal)} />
        {quoted && quoted.quote.assemblyCents > 0 && (
          <Row label={t("assembly")} value={money(quoted.quote.assemblyCents)} />
        )}
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
