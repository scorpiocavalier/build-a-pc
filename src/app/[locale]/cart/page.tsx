import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Suspense } from "react";

import { CategoryIcon } from "@/components/catalog/category-icon";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LOCATION_CODES } from "@/lib/catalog/product-input";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { getCheckoutCart, MAX_LINE_QUANTITY } from "@/server/cart";
import { getSettings } from "@/server/settings";

import { removeCartBuildAction, updateCartLineAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Cart");
  return { title: t("title"), robots: { index: false } };
}

export default async function CartPage() {
  const t = await getTranslations("Cart");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense
        fallback={<div aria-hidden="true" className="h-48 animate-pulse rounded-lg bg-surface" />}
      >
        <CartContents />
      </Suspense>
    </div>
  );
}

async function CartContents() {
  const [{ lines, builds }, settings, t, builder, catalog, locale] = await Promise.all([
    getCheckoutCart(),
    getSettings(),
    getTranslations("Cart"),
    getTranslations("Builder"),
    getTranslations("Catalog"),
    getLocale(),
  ]);

  if (lines.length === 0 && builds.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border bg-surface p-8">
        <p className="text-muted">{t("empty")}</p>
        <Button asChild>
          <Link href="/shop">{t("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  const buildCents = (build: (typeof builds)[number]) =>
    [...build.parts, ...(build.windows ? [build.windows] : [])].reduce(
      (sum, l) => sum + l.unitPriceCents * l.quantity,
      settings.assemblyFeeCents,
    );
  const subtotal =
    lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0) +
    builds.reduce((sum, b) => sum + buildCents(b), 0);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-4">
        {builds.map((build) => (
          <section key={build.id} className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{t("assembledBuild")}</h2>
                <p className="text-sm text-muted">{t("assembledIncludes")}</p>
              </div>
              <p className="font-semibold tabular-nums">{formatMoney(buildCents(build), locale)}</p>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {build.parts.map((part) => (
                <li key={part.productId} className="flex justify-between gap-3">
                  <span>
                    <span className="text-muted">{builder(`slots.${part.slot!}`)}: </span>
                    {part.quantity > 1 && `${part.quantity} × `}
                    {localize(part.name, locale)}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(part.unitPriceCents * part.quantity, locale)}
                  </span>
                </li>
              ))}
              {build.windows && (
                <li className="flex justify-between gap-3">
                  <span>{localize(build.windows.name, locale)}</span>
                  <span className="tabular-nums">
                    {formatMoney(build.windows.unitPriceCents, locale)}
                  </span>
                </li>
              )}
              <li className="flex justify-between gap-3">
                <span>{t("assemblyFee")}</span>
                <span className="tabular-nums">
                  {formatMoney(settings.assemblyFeeCents, locale)}
                </span>
              </li>
            </ul>
            <form action={removeCartBuildAction}>
              <input type="hidden" name="buildId" value={build.id} />
              <Button size="sm" variant="ghost">
                <Trash2 aria-hidden="true" className="size-4" />
                {t("removeBuild")}
              </Button>
            </form>
          </section>
        ))}
        {lines.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border bg-surface">
            {lines.map((line) => {
              const name = localize(line.name, locale);
              const where = LOCATION_CODES.filter((code) => line.available[code] >= line.quantity);
              return (
                <li key={line.productId} className="flex gap-4 p-4">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-raised">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt=""
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <CategoryIcon slug={line.categorySlug} className="size-8 text-muted" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-xs tracking-wide text-muted uppercase">{line.brand}</p>
                    <Link href={`/p/${line.slug}`} className="font-medium hover:text-accent">
                      {name}
                    </Link>
                    <p className="text-sm text-muted">
                      {t("each", { price: formatMoney(line.unitPriceCents, locale) })}
                    </p>
                    <p className={where.length ? "text-sm" : "text-sm text-amber-300"}>
                      {where.length
                        ? t("availableAt", {
                            locations: where.map((code) => catalog(`locations.${code}`)).join(", "),
                          })
                        : t("notAvailable")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={updateCartLineAction} className="flex items-center gap-2">
                        <input type="hidden" name="productId" value={line.productId} />
                        <select
                          name="quantity"
                          defaultValue={line.quantity}
                          aria-label={t("quantityFor", { name })}
                          className="h-9 rounded-lg border bg-background px-2"
                        >
                          {Array.from({ length: MAX_LINE_QUANTITY }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline">
                          {t("update")}
                        </Button>
                      </form>
                      <form action={updateCartLineAction}>
                        <input type="hidden" name="productId" value={line.productId} />
                        <input type="hidden" name="quantity" value="0" />
                        <Button size="sm" variant="ghost" aria-label={`${t("remove")}: ${name}`}>
                          <Trash2 aria-hidden="true" className="size-4" />
                          {t("remove")}
                        </Button>
                      </form>
                    </div>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(line.unitPriceCents * line.quantity, locale)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <aside className="flex h-fit flex-col gap-4 rounded-lg border bg-surface p-5">
        <div className="flex justify-between text-lg font-semibold">
          <span>{t("subtotal")}</span>
          <span className="tabular-nums">{formatMoney(subtotal, locale)}</span>
        </div>
        <p className="text-sm text-muted">{t("taxNote")}</p>
        <Button asChild>
          <Link href="/checkout">{t("checkout")}</Link>
        </Button>
        <Link href="/shop" className="text-center text-sm text-accent hover:underline">
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
