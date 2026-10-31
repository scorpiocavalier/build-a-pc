import { Check, SlidersHorizontal, X } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  applyFilters,
  buildFacets,
  parseFilters,
  SORTS,
  toggleHref,
  type Facet,
} from "@/lib/catalog/filters";
import { LOCATION_CODES } from "@/lib/catalog/product-input";
import { localize } from "@/lib/localized";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { formatOption, formatSpecValue } from "@/lib/specs/format";
import { cn } from "@/lib/utils";
import { getCategoryProducts } from "@/server/catalog/queries";

type Props = PageProps<"/[locale]/c/[category]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const definition = getCategoryDefinition(category);
  if (!definition) return {};
  return { title: localize(definition.name, await getLocale()) };
}

export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <Suspense fallback={<CategorySkeleton />}>
        <CategoryListing params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryListing({ params, searchParams }: Props) {
  const [{ category: slug }, query, t, locale] = await Promise.all([
    params,
    searchParams,
    getTranslations("Catalog"),
    getLocale(),
  ]);
  const definition = getCategoryDefinition(slug);
  const data = definition ? await getCategoryProducts(slug) : null;
  if (!definition || !data) notFound();

  const filters = parseFilters(definition, query);
  const products = applyFilters(data.products, filters);
  const facets = buildFacets(definition, data.products, filters);
  const hasFilters = Object.keys(filters.values).length > 0 || filters.availableAt.length > 0;
  const name = localize(data.category.name, locale);

  const facetLabel = (facet: Facet) =>
    facet.field ? localize(facet.field.label, locale) : t("brand");
  const optionLabel = (facet: Facet, value: string) => {
    if (!facet.field) return value;
    if (facet.field.type === "boolean")
      return formatSpecValue(facet.field, value === "true", locale);
    if (facet.field.type === "int" || facet.field.type === "decimal") {
      return formatSpecValue(facet.field, Number(value), locale);
    }
    return formatOption(facet.field, value, locale);
  };

  const filterPanel = (
    <>
      <FilterGroup title={t("availability")}>
        {LOCATION_CODES.map((code) => (
          <FilterLink
            key={code}
            href={`/c/${slug}${toggleHref(query, "available", code)}`}
            selected={filters.availableAt.includes(code)}
            label={t("availableAt", { location: t(`locations.${code}`) })}
            selectedLabel={t("selected")}
          />
        ))}
      </FilterGroup>
      {facets.map((facet) => (
        <FilterGroup key={facet.key} title={facetLabel(facet)}>
          {facet.options.map((option) => (
            <FilterLink
              key={option.value}
              href={`/c/${slug}${toggleHref(query, facet.key, option.value)}`}
              selected={option.selected}
              label={optionLabel(facet, option.value)}
              count={option.count}
              selectedLabel={t("selected")}
            />
          ))}
        </FilterGroup>
      ))}
      {hasFilters && (
        <Link
          href={`/c/${slug}`}
          className="flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <X aria-hidden="true" className="size-4" />
          {t("clearFilters")}
        </Link>
      )}
    </>
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("shop"), href: "/shop" },
          { label: name },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-muted" role="status">
            {t("results", { count: products.length })}
          </p>
        </div>
        <form className="flex items-end gap-2">
          {/* Keep active filters when changing the sort. */}
          {Object.entries(filters.values).flatMap(([key, values]) =>
            values.map((v) => <input key={`${key}=${v}`} type="hidden" name={key} value={v} />),
          )}
          {filters.availableAt.map((code) => (
            <input key={code} type="hidden" name="available" value={code} />
          ))}
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t("sortBy")}
            <select
              name="sort"
              defaultValue={filters.sort}
              className="h-9 rounded-lg border bg-surface px-2 text-foreground"
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sort.${sort}`)}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline">
            {t("applySort")}
          </Button>
        </form>
      </div>

      <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
        {/* Mobile: collapsed so products aren't pushed off screen. */}
        <details open={hasFilters} className="rounded-lg border bg-surface md:hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {t("filters")}
          </summary>
          <div className="flex flex-col gap-6 border-t p-4">{filterPanel}</div>
        </details>
        <aside aria-label={t("filters")} className="hidden flex-col gap-6 md:flex">
          {filterPanel}
        </aside>

        {products.length ? (
          <ul className="grid grid-cols-2 content-start gap-3 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="self-start rounded-lg border bg-surface p-8 text-center text-muted">
            {t("noResults")}
          </p>
        )}
      </div>
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

// Filters are plain links so they work without JavaScript and can be shared.
function FilterLink({
  href,
  selected,
  label,
  count,
  selectedLabel,
}: {
  href: string;
  selected: boolean;
  label: string;
  count?: number;
  selectedLabel: string;
}) {
  const disabled = !selected && count === 0;
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        rel="nofollow"
        aria-disabled={disabled || undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-surface-raised",
          disabled && "pointer-events-none text-muted/60",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border",
            selected && "border-accent bg-accent text-accent-foreground",
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
        <span className="flex-1">
          {label}
          {selected && <span className="sr-only"> ({selectedLabel})</span>}
        </span>
        {count !== undefined && <span className="text-xs text-muted">{count}</span>}
      </Link>
    </li>
  );
}

function CategorySkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
      <div className="h-4 w-48 rounded bg-surface-raised" />
      <div className="h-9 w-64 rounded bg-surface-raised" />
      <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
        <div className="h-64 rounded-lg bg-surface" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
