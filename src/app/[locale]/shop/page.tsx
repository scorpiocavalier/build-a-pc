import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localized";
import { getCategories } from "@/server/catalog/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Catalog");
  return { title: t("shopTitle"), description: t("shopLead") };
}

export default async function ShopPage() {
  const [t, locale, categories] = await Promise.all([
    getTranslations("Catalog"),
    getLocale(),
    getCategories(),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <Breadcrumbs items={[{ label: t("home"), href: "/" }, { label: t("shop") }]} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("shopTitle")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("shopLead")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/c/${category.slug}`}
              className="flex h-full flex-col gap-4 rounded-lg border bg-surface p-5 transition-colors hover:border-accent/60 hover:bg-surface-raised"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <CategoryIcon slug={category.slug} className="size-5" />
              </span>
              <span>
                <span className="block font-medium">{localize(category.name, locale)}</span>
                <span className="text-sm text-muted">
                  {t("productCount", { count: category.productCount })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
