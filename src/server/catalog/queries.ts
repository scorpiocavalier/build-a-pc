import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { LocationCode } from "@/lib/catalog/product-input";
import type { LocalizedText } from "@/lib/localized";
import type { SpecValues } from "@/lib/specs/types";
import { db } from "@/server/db";
import { publicUrl } from "@/server/storage";

// Storefront reads. Everything here is cached and tagged CATALOG_TAG; admin
// writes call updateTag(CATALOG_TAG) so customers see changes right away.

export const CATALOG_TAG = "catalog";

export type Availability = Record<LocationCode, number>;

export type ProductImageView = {
  url: string;
  alt: LocalizedText;
  width: number;
  height: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  sku: string;
  name: LocalizedText;
  brand: string;
  categorySlug: string;
  priceCents: number;
  compareAtCents: number | null;
  specs: SpecValues;
  image: ProductImageView | null;
  available: Availability;
};

export type ProductDetail = ProductSummary & {
  description: LocalizedText;
  mpn: string | null;
  warrantyMonths: number | null;
  categoryName: LocalizedText;
  images: ProductImageView[];
};

const summarySelect = {
  id: true,
  slug: true,
  sku: true,
  name: true,
  priceCents: true,
  compareAtCents: true,
  specs: true,
  brand: { select: { name: true } },
  category: { select: { slug: true, name: true } },
  images: {
    orderBy: { position: "asc" },
    select: { key: true, alt: true, width: true, height: true },
  },
  inventory: { select: { onHand: true, reserved: true, location: { select: { code: true } } } },
} satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: typeof summarySelect }>;

function toImage(image: SummaryRow["images"][number]): ProductImageView {
  return {
    url: publicUrl(image.key),
    alt: image.alt as LocalizedText,
    width: image.width,
    height: image.height,
  };
}

function toSummary(row: SummaryRow): ProductSummary {
  const available: Availability = { TOR: 0, MTL: 0 };
  for (const stock of row.inventory) {
    available[stock.location.code] = Math.max(0, stock.onHand - stock.reserved);
  }
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name as LocalizedText,
    brand: row.brand.name,
    categorySlug: row.category.slug,
    priceCents: row.priceCents,
    compareAtCents: row.compareAtCents,
    specs: row.specs as SpecValues,
    image: row.images[0] ? toImage(row.images[0]) : null,
    available,
  };
}

export type CategorySummary = { slug: string; name: LocalizedText; productCount: number };

export async function getCategories(): Promise<CategorySummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name as LocalizedText,
    productCount: c._count.products,
  }));
}

export async function getCategoryProducts(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const category = await db.category.findUnique({
    where: { slug },
    select: { slug: true, name: true },
  });
  if (!category) return null;

  const rows = await db.product.findMany({
    where: { category: { slug }, status: "ACTIVE" },
    orderBy: { priceCents: "asc" },
    select: summarySelect,
  });
  return {
    category: { slug: category.slug, name: category.name as LocalizedText },
    products: rows.map(toSummary),
  };
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const row = await db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { ...summarySelect, description: true, mpn: true, warrantyMonths: true },
  });
  if (!row) return null;
  return {
    ...toSummary(row),
    description: row.description as LocalizedText,
    mpn: row.mpn,
    warrantyMonths: row.warrantyMonths,
    categoryName: row.category.name as LocalizedText,
    images: row.images.map(toImage),
  };
}

// Full-text search over English and French names, brand and SKU, with a
// substring fallback so partial model numbers ("9800") still match.
export async function searchProducts(query: string): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const matches = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "Product" p
    JOIN "Brand" b ON b.id = p."brandId"
    CROSS JOIN LATERAL (
      SELECT
        setweight(to_tsvector('english', coalesce(p.name->>'en', '')), 'A') ||
        setweight(to_tsvector('french', coalesce(p.name->>'fr', '')), 'A') ||
        setweight(to_tsvector('simple', b.name || ' ' || p.sku), 'B') ||
        setweight(to_tsvector('english', coalesce(p.description->>'en', '')), 'C') ||
        setweight(to_tsvector('french', coalesce(p.description->>'fr', '')), 'C') AS doc,
        websearch_to_tsquery('english', ${q}) ||
        websearch_to_tsquery('french', ${q}) ||
        websearch_to_tsquery('simple', ${q}) AS query
    ) s
    WHERE p.status = 'ACTIVE'
      AND (
        s.doc @@ s.query
        OR p.sku ILIKE ${like}
        OR p.name->>'en' ILIKE ${like}
        OR p.name->>'fr' ILIKE ${like}
        OR b.name ILIKE ${like}
      )
    ORDER BY ts_rank(s.doc, s.query) DESC, p."priceCents" ASC
    LIMIT 48
  `;
  if (!matches.length) return [];

  const rows = await db.product.findMany({
    where: { id: { in: matches.map((m) => m.id) } },
    select: summarySelect,
  });
  const byId = new Map(rows.map((row) => [row.id, toSummary(row)]));
  return matches.map((m) => byId.get(m.id)).filter((p) => p !== undefined);
}
