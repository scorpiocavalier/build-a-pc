import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CategoryIcon } from "@/components/catalog/category-icon";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { SLOT_CATEGORY, SLOT_MAX_QUANTITY, slotFromParam, slotToParam } from "@/lib/builder/slots";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { formatSpecValue } from "@/lib/specs/format";
import { cn } from "@/lib/utils";
import { getMyBuild, listCandidates, type Candidate } from "@/server/builder";

import { chooseAction } from "../actions";

type Props = PageProps<"/[locale]/build/[slot]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slot = slotFromParam((await params).slot);
  if (!slot) return {};
  const t = await getTranslations("Builder");
  return {
    title: t("pickerTitle", { slot: t(`slots.${slot}`).toLowerCase() }),
    robots: { index: false },
  };
}

export default function PickerPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <Picker params={params} />
      </Suspense>
    </div>
  );
}

async function Picker({ params }: Pick<Props, "params">) {
  const slot = slotFromParam((await params).slot);
  if (!slot) notFound();
  const [build, t, locale] = await Promise.all([
    getMyBuild(),
    getTranslations("Builder"),
    getLocale(),
  ]);
  const { candidates } = await listCandidates(slot, build);
  const compatible = candidates.filter((c) => c.errors.length === 0);
  const incompatible = candidates.filter((c) => c.errors.length > 0);
  const label = t(`slots.${slot}`);

  return (
    <>
      <div>
        <Link
          href="/build"
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("back")}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t("pickerTitle", { slot: label.toLowerCase() })}
        </h1>
        <p className="mt-1 text-muted" role="status">
          {t("compatible", { count: compatible.length })}
        </p>
      </div>
      <CandidateList candidates={compatible} slot={slot} build={build} locale={locale} />
      {incompatible.length > 0 && (
        <details className="rounded-lg border bg-surface/60 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("notCompatible", { count: incompatible.length })}
          </summary>
          <div className="mt-4">
            <CandidateList candidates={incompatible} slot={slot} build={build} locale={locale} />
          </div>
        </details>
      )}
    </>
  );
}

async function CandidateList({
  candidates,
  slot,
  build,
  locale,
}: {
  candidates: Candidate[];
  slot: NonNullable<ReturnType<typeof slotFromParam>>;
  build: Awaited<ReturnType<typeof getMyBuild>>;
  locale: string;
}) {
  const [t, catalog] = await Promise.all([getTranslations("Builder"), getTranslations("Catalog")]);
  const location = build?.location ?? "TOR";
  const definition = getCategoryDefinition(SLOT_CATEGORY[slot])!;
  const keyFields = definition.fields.filter((f) => f.filter).slice(0, 3);
  const current = build?.items[slot];
  const maxQuantity = SLOT_MAX_QUANTITY[slot];

  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-surface">
      {candidates.map((product) => {
        const name = localize(product.name, locale);
        const blocked = product.errors.length > 0;
        const here = product.available[location] > 0;
        return (
          <li
            key={product.id}
            className={cn(
              "flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap",
              blocked && "opacity-70",
            )}
          >
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-raised">
              {product.image ? (
                <Image
                  src={product.image.url}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              ) : (
                <CategoryIcon slug={SLOT_CATEGORY[slot]} className="size-6 text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1 max-sm:basis-[calc(100%-4.25rem)]">
              <p className="font-medium">
                {product.brand} {name}
              </p>
              <p className="text-xs text-muted">
                {keyFields
                  .filter((f) => product.specs[f.key] !== undefined)
                  .map((f) => formatSpecValue(f, product.specs[f.key], locale))
                  .join(" · ")}
              </p>
              <p className={cn("text-xs", here ? "text-muted" : "text-amber-300")}>
                {here
                  ? t("inStockHere", { location: catalog(`locations.${location}`) })
                  : t("notHere", { location: catalog(`locations.${location}`) })}
              </p>
              {blocked && (
                <ul className="mt-1 text-xs text-red-300">
                  {product.errors.map((issue, i) => (
                    <li key={i}>{t(`issues.${issue.rule}`, issue.params ?? {})}</li>
                  ))}
                </ul>
              )}
            </div>
            <p className="font-semibold tabular-nums max-sm:ml-[4.25rem]">
              {formatMoney(product.priceCents, locale)}
            </p>
            <form action={chooseAction} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="slot" value={slotToParam(slot)} />
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="locale" value={locale} />
              {maxQuantity > 1 && (
                <select
                  name="quantity"
                  defaultValue={current?.productId === product.id ? current.quantity : 1}
                  aria-label={`${t("quantity")}: ${name}`}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
              {current?.productId === product.id && maxQuantity === 1 ? (
                <span className="text-sm text-accent">{t("current")}</span>
              ) : (
                <Button
                  size="sm"
                  variant={blocked ? "outline" : "primary"}
                  aria-label={`${t("select")}: ${name}`}
                >
                  {t("select")}
                </Button>
              )}
            </form>
          </li>
        );
      })}
    </ul>
  );
}
