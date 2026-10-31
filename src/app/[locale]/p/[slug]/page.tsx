import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { Price } from "@/components/catalog/price";
import { LOCATION_CODES } from "@/lib/catalog/product-input";
import { localize } from "@/lib/localized";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { formatSpecValue } from "@/lib/specs/format";
import { cn } from "@/lib/utils";
import { getProduct, type ProductDetail } from "@/server/catalog/queries";

type Props = PageProps<"/[locale]/p/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [product, locale] = await Promise.all([getProduct(slug), getLocale()]);
  if (!product) return {};
  const name = `${product.brand} ${localize(product.name, locale)}`;
  return {
    title: name,
    description: localize(product.description, locale) || undefined,
    openGraph: product.image ? { images: [product.image.url] } : undefined,
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={
          <div aria-hidden="true" className="h-[32rem] animate-pulse rounded-lg bg-surface" />
        }
      >
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const [product, t, locale] = await Promise.all([
    getProduct(slug),
    getTranslations("Catalog"),
    getLocale(),
  ]);
  if (!product) notFound();

  const definition = getCategoryDefinition(product.categorySlug);
  const name = localize(product.name, locale);
  const description = localize(product.description, locale);
  const specRows = (definition?.fields ?? [])
    .filter((field) => product.specs[field.key] !== undefined)
    .map((field) => ({
      key: field.key,
      label: localize(field.label, locale),
      value: formatSpecValue(field, product.specs[field.key], locale),
    }));
  const inStock = LOCATION_CODES.some((code) => product.available[code] > 0);

  return (
    <>
      <ProductJsonLd product={product} name={name} description={description} inStock={inStock} />
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("shop"), href: "/shop" },
          { label: localize(product.categoryName, locale), href: `/c/${product.categorySlug}` },
          { label: name },
        ]}
      />

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-surface-raised">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={localize(product.images[0].alt, locale) || name}
                width={product.images[0].width}
                height={product.images[0].height}
                sizes="(min-width: 768px) 50vw, 100vw"
                priority
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-2 text-muted">
                <CategoryIcon slug={product.categorySlug} className="size-20 opacity-60" />
                <span className="text-sm">{t("noImage")}</span>
              </span>
            )}
          </div>
          {product.images.length > 1 && (
            <ul className="grid grid-cols-4 gap-2">
              {product.images.slice(1).map((image) => (
                <li key={image.url} className="overflow-hidden rounded-md border">
                  <Image
                    src={image.url}
                    alt={localize(image.alt, locale) || name}
                    width={image.width}
                    height={image.height}
                    sizes="12vw"
                    className="aspect-square h-full w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium tracking-wide text-muted uppercase">
              {product.brand}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{name}</h1>
            <p className="mt-2 text-sm text-muted">
              {t("sku")}: {product.sku}
              {product.mpn && (
                <>
                  {" · "}
                  {t("mpn")}: {product.mpn}
                </>
              )}
            </p>
          </div>

          <Price
            cents={product.priceCents}
            compareAtCents={product.compareAtCents}
            className="text-2xl"
          />

          <section aria-labelledby="availability" className="rounded-lg border bg-surface p-4">
            <h2 id="availability" className="text-sm font-semibold">
              {t("availabilityTitle")}
            </h2>
            <ul className="mt-2 flex flex-col gap-1">
              {LOCATION_CODES.map((code) => (
                <li key={code} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full",
                      product.available[code] > 0 ? "bg-emerald-400" : "bg-muted/50",
                    )}
                  />
                  {t("stockAt", {
                    location: t(`locations.${code}`),
                    count: product.available[code],
                  })}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">{t("orderingSoon")}</p>
          </section>

          {product.warrantyMonths ? (
            <p className="text-sm text-muted">
              {t("warranty", { months: product.warrantyMonths })}
            </p>
          ) : null}

          {description && (
            <section aria-labelledby="description">
              <h2 id="description" className="text-lg font-semibold">
                {t("description")}
              </h2>
              <p className="mt-2 whitespace-pre-line text-muted">{description}</p>
            </section>
          )}
        </div>
      </div>

      {specRows.length > 0 && (
        <section aria-labelledby="specs" className="max-w-3xl">
          <h2 id="specs" className="text-lg font-semibold">
            {t("specs")}
          </h2>
          <dl className="mt-3 divide-y overflow-hidden rounded-lg border">
            {specRows.map((row) => (
              <div key={row.key} className="grid grid-cols-2 gap-4 bg-surface px-4 py-2.5 text-sm">
                <dt className="text-muted">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

function ProductJsonLd({
  product,
  name,
  description,
  inStock,
}: {
  product: ProductDetail;
  name: string;
  description: string;
  inStock: boolean;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description || undefined,
    sku: product.sku,
    mpn: product.mpn ?? undefined,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "CAD",
      price: (product.priceCents / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return (
    <script
      type="application/ld+json"
      // Escape "<" so product text can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
