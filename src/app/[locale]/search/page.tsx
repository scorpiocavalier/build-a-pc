import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { searchProducts } from "@/server/catalog/queries";

type Props = PageProps<"/[locale]/search">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Catalog");
  return { title: t("searchTitle"), robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations("Catalog"), getLocale()]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("searchTitle")}</h1>
      <Suspense
        fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-lg bg-surface" />}
      >
        <SearchResults searchParams={searchParams} locale={locale} />
      </Suspense>
    </div>
  );
}

async function SearchResults({
  searchParams,
  locale,
}: Pick<Props, "searchParams"> & { locale: string }) {
  const [{ q }, t, header] = await Promise.all([
    searchParams,
    getTranslations("Catalog"),
    getTranslations("Header"),
  ]);
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const results = query ? await searchProducts(query) : [];

  return (
    <>
      <form action={`/${locale}/search`} role="search" className="flex max-w-xl gap-2">
        <label className="sr-only" htmlFor="search-page-q">
          {header("searchLabel")}
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <input
            id="search-page-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={header("searchPlaceholder")}
            className="h-11 w-full rounded-lg border bg-surface pr-3 pl-9"
          />
        </div>
        <Button>{t("searchButton")}</Button>
      </form>

      {query ? (
        <>
          <p role="status" className="text-muted">
            {t("searchResults", { count: results.length, query })}
          </p>
          {results.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {results.map((product) => (
                <li key={product.id} className="flex">
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-muted">{t("searchEmpty")}</p>
      )}
    </>
  );
}
