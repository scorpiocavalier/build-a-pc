import "server-only";

import type { Prisma, ProductStatus } from "@/generated/prisma/client";
import { LOCATION_CODES, PRODUCT_STATUSES, type LocationCode } from "@/lib/catalog/product-input";
import type { LocalizedText } from "@/lib/localized";
import type { SpecValues } from "@/lib/specs/types";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";
import { publicUrl } from "@/server/storage";

// Admin reads are never cached: admins must always see current data.
// Each one checks admin access itself (data access layer), so a page can't
// leak data even if it forgets to.

const missingFrench: Prisma.ProductWhereInput = {
  OR: [{ name: { path: ["fr"], equals: "" } }, { description: { path: ["fr"], equals: "" } }],
};
const outOfStock: Prisma.ProductWhereInput = { inventory: { none: { onHand: { gt: 0 } } } };

export async function getAdminDashboard() {
  await requireAdmin();
  const [active, drafts, missing, out] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "DRAFT" } }),
    db.product.count({ where: { status: { not: "ARCHIVED" }, ...missingFrench } }),
    db.product.count({ where: { status: "ACTIVE", ...outOfStock } }),
  ]);
  return { active, drafts, missingFrench: missing, outOfStock: out };
}

export type AdminProductFilters = {
  q?: string;
  category?: string;
  status?: string;
  missing?: string;
  stock?: string;
};

export async function listAdminProducts(filters: AdminProductFilters) {
  await requireAdmin();
  const and: Prisma.ProductWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { mpn: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { name: { path: ["en"], string_contains: q, mode: "insensitive" } },
        { name: { path: ["fr"], string_contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.category) and.push({ category: { slug: filters.category } });
  if (PRODUCT_STATUSES.includes(filters.status as ProductStatus)) {
    and.push({ status: filters.status as ProductStatus });
  }
  if (filters.missing === "fr") and.push(missingFrench);
  if (filters.stock === "out") and.push(outOfStock);

  const rows = await db.product.findMany({
    where: { AND: and },
    orderBy: [{ category: { position: "asc" } }, { updatedAt: "desc" }],
    take: 500,
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      status: true,
      priceCents: true,
      brand: { select: { name: true } },
      category: { select: { slug: true, name: true } },
      inventory: { select: { onHand: true, location: { select: { code: true } } } },
      _count: { select: { images: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name as LocalizedText,
    brand: row.brand.name,
    category: row.category.name as LocalizedText,
    status: row.status,
    priceCents: row.priceCents,
    imageCount: row._count.images,
    missingFrench: !(row.name as LocalizedText).fr || !(row.description as LocalizedText).fr,
    stock: Object.fromEntries(
      LOCATION_CODES.map((code) => [
        code,
        row.inventory.find((i) => i.location.code === code)?.onHand ?? 0,
      ]),
    ) as Record<LocationCode, number>,
  }));
}

export async function getAdminProduct(id: string) {
  await requireAdmin();
  const row = await db.product.findUnique({
    where: { id },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { position: "asc" } },
      inventory: { include: { location: true } },
    },
  });
  if (!row) return null;
  return {
    ...row,
    name: row.name as LocalizedText,
    description: row.description as LocalizedText,
    specs: row.specs as SpecValues,
    images: row.images.map((image) => ({
      id: image.id,
      url: publicUrl(image.key),
      alt: image.alt as LocalizedText,
      width: image.width,
      height: image.height,
    })),
    stock: Object.fromEntries(
      LOCATION_CODES.map((code) => [
        code,
        row.inventory.find((i) => i.location.code === code)?.onHand ?? 0,
      ]),
    ) as Record<LocationCode, number>,
  };
}

export async function listBrandNames(): Promise<string[]> {
  await requireAdmin();
  const brands = await db.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  return brands.map((b) => b.name);
}

export async function listProductsForExport(categorySlug: string) {
  await requireAdmin();
  const rows = await db.product.findMany({
    where: { category: { slug: categorySlug } },
    orderBy: { sku: "asc" },
    include: { brand: true, inventory: { include: { location: true } } },
  });
  return rows.map((row) => ({
    ...row,
    categorySlug,
    brandName: row.brand.name,
    name: row.name as LocalizedText,
    description: row.description as LocalizedText,
    specs: row.specs as SpecValues,
    stock: Object.fromEntries(
      LOCATION_CODES.map((code) => [
        code,
        row.inventory.find((i) => i.location.code === code)?.onHand ?? 0,
      ]),
    ) as Record<LocationCode, number>,
  }));
}
