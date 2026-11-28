import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { filterBySpecs } from "@/lib/catalog/admin-spec-filter";
import {
  listedStatuses,
  removalOutcome,
  type ProductUsage,
  type RemovalOutcome,
} from "@/lib/catalog/product-removal";
import type { LocalizedText } from "@/lib/localized";
import type { SpecValues } from "@/lib/specs/types";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { lastPurchaseCosts } from "@/server/inventory-cost";
import { DEFAULT_LOCATION } from "@/lib/store-config";
import { requireAdmin } from "@/server/require-admin";
import { publicUrl } from "@/server/storage";

// Admin reads are never cached: admins must always see current data.
// Each one checks admin access itself (data access layer), so a page can't
// leak data even if it forgets to.

const missingFrench: Prisma.ProductWhereInput = {
  OR: [{ name: { path: ["fr"], equals: "" } }, { description: { path: ["fr"], equals: "" } }],
};
// Only the store's stock counts (the database may still hold another store's
// rows from when the site ran two).
const outOfStock: Prisma.ProductWhereInput = {
  inventory: { none: { onHand: { gt: 0 }, location: { code: DEFAULT_LOCATION } } },
};

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
  brand?: string;
  // "fr": missing French text; "photos": no photos.
  missing?: string;
  stock?: string;
  // Spec filters for the chosen category, e.g. { socket: "AM5" }.
  specs?: Record<string, string>;
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
  if (filters.brand) and.push({ brand: { slug: filters.brand } });
  // Archived products are hidden unless the Archived status is picked.
  and.push({ status: { in: listedStatuses(filters.status) } });
  if (filters.missing === "fr") and.push(missingFrench);
  if (filters.missing === "photos") and.push({ images: { none: {} } });
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
      specs: true,
      brand: { select: { name: true } },
      category: { select: { slug: true, name: true } },
      inventory: {
        where: { location: { code: DEFAULT_LOCATION } },
        select: { onHand: true, avgCostCents: true },
      },
      _count: { select: { images: true } },
    },
  });

  const { rows: matching, facets } = filterBySpecs(filters.category, rows, filters.specs ?? {});
  const lastCost = await lastPurchaseCosts(
    db,
    matching.map((row) => row.id),
  );
  const products = matching.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name as LocalizedText,
    brand: row.brand.name,
    category: row.category.name as LocalizedText,
    status: row.status,
    priceCents: row.priceCents,
    imageCount: row._count.images,
    missingFrench: !(row.name as LocalizedText).fr || !(row.description as LocalizedText).fr,
    stock: row.inventory[0]?.onHand ?? 0,
    // Average cost and the latest purchase's landed cost.
    cost: {
      avgCostCents: row.inventory[0]?.avgCostCents ?? null,
      lastCostCents: lastCost.get(row.id) ?? null,
    },
  }));
  return { products, specFacets: facets };
}

export async function getAdminProduct(id: string) {
  await requireAdmin();
  const row = await db.product.findUnique({
    where: { id },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { position: "asc" } },
      inventory: { where: { location: { code: DEFAULT_LOCATION } } },
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
    stock: row.inventory[0]?.onHand ?? 0,
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
    include: { brand: true, inventory: { where: { location: { code: DEFAULT_LOCATION } } } },
  });
  return rows.map((row) => ({
    ...row,
    categorySlug,
    brandName: row.brand.name,
    name: row.name as LocalizedText,
    description: row.description as LocalizedText,
    specs: row.specs as SpecValues,
    stock: row.inventory[0]?.onHand ?? 0,
  }));
}

// Choices for the product list's brand dropdown.
export async function listBrands() {
  await requireAdmin();
  return db.brand.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
}

// Where a product is used, which decides whether "Delete product" deletes or
// archives it, and what the confirmation says.
async function productUsage(client: Prisma.TransactionClient, id: string): Promise<ProductUsage> {
  const [orders, purchases, builds] = await Promise.all([
    client.order.count({ where: { lines: { some: { productId: id } } } }),
    client.purchase.count({ where: { lines: { some: { productId: id } } } }),
    client.build.findMany({
      where: { items: { some: { productId: id } } },
      orderBy: { position: "asc" },
      select: { featured: true, title: true, name: true, shareId: true },
    }),
  ]);
  const featured = builds.filter((b) => b.featured);
  return {
    orders,
    purchases,
    featuredBuilds: featured.map(
      (b) => (b.title as LocalizedText | null)?.en || b.name || b.shareId,
    ),
    otherBuilds: builds.length - featured.length,
  };
}

export async function getProductUsage(id: string): Promise<ProductUsage> {
  await requireAdmin();
  return productUsage(db, id);
}

export type DeleteProductResult = {
  outcome: RemovalOutcome;
  sku: string;
  // Stored image files to delete once the product is gone (empty when archived).
  imageKeys: string[];
};

// Deletes a product that was never sold or bought, or archives one that was
// (past orders, refunds, reports and average costs still need it). Either way
// it's taken out of every build, so prebuilt PCs get a replacement part and
// customers' builds don't keep an unavailable one. Returns null if the product
// doesn't exist. The caller checks admin access and deletes the image files.
export async function deleteProduct(
  id: string,
  actorId: string,
): Promise<DeleteProductResult | null> {
  const attempt = () =>
    db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: { sku: true, name: true, status: true, images: { select: { key: true } } },
      });
      if (!product) return null;
      const usage = await productUsage(tx, id);
      const outcome = removalOutcome(usage);
      const name = (product.name as LocalizedText).en;

      if (outcome === "deleted") {
        // Images, stock, stock movements, cart lines, build items and
        // wishlist entries cascade.
        await tx.product.delete({ where: { id } });
      } else {
        await tx.buildItem.deleteMany({ where: { productId: id } });
        await tx.product.update({ where: { id }, data: { status: "ARCHIVED" } });
      }

      const where = [
        usage.orders && `${usage.orders} order${usage.orders === 1 ? "" : "s"}`,
        usage.purchases && `${usage.purchases} purchase${usage.purchases === 1 ? "" : "s"}`,
      ].filter(Boolean);
      await audit(
        {
          actorId,
          action: outcome === "deleted" ? "product.delete" : "product.archive",
          entity: "product",
          entityId: id,
          summary:
            outcome === "deleted"
              ? `Deleted ${product.sku} (${name})`
              : `Archived ${product.sku} (${name}) instead of deleting it: in ${where.join(" and ")}`,
          details: {
            sku: product.sku,
            name,
            outcome,
            orders: usage.orders,
            purchases: usage.purchases,
            featuredBuilds: usage.featuredBuilds,
            otherBuilds: usage.otherBuilds,
          },
        },
        tx,
      );
      return {
        outcome,
        sku: product.sku,
        imageKeys: outcome === "deleted" ? product.images.map((i) => i.key) : [],
      };
    });

  try {
    return await attempt();
  } catch (error) {
    // An order or purchase for the product was saved while it was being
    // deleted (foreign key violation): try again, which archives it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return attempt();
    }
    throw error;
  }
}
