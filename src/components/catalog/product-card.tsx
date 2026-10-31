import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localized";
import type { ProductSummary } from "@/server/catalog/queries";

import { CategoryIcon } from "./category-icon";
import { Price } from "./price";
import { StockSummary } from "./stock-summary";

export function ProductCard({ product }: { product: ProductSummary }) {
  const locale = useLocale();
  const t = useTranslations("Catalog");
  const name = localize(product.name, locale);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border bg-surface transition-colors hover:border-accent/60">
      <div className="flex aspect-square items-center justify-center bg-surface-raised">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={localize(product.image.alt, locale) || name}
            width={product.image.width}
            height={product.image.height}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted">
            <CategoryIcon slug={product.categorySlug} className="size-12 opacity-60" />
            <span className="text-xs">{t("noImage")}</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{product.brand}</p>
        <h3 className="leading-snug font-medium">
          <Link href={`/p/${product.slug}`} className="after:absolute after:inset-0">
            {name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
          <StockSummary available={product.available} />
        </div>
      </div>
    </article>
  );
}
