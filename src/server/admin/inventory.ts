import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { filterBySpecs } from "@/lib/catalog/admin-spec-filter";
import { DEFAULT_LOCATION } from "@/lib/store-config";
import {
  matchesCost,
  matchesStock,
  type CostFilter,
  type CostRules,
  type StockLevel,
} from "@/lib/inventory/filter";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { averageCost, lastPurchaseCosts } from "@/server/inventory-cost";
import { requireAdmin } from "@/server/require-admin";

// The store's stock and manual adjustments. Available = on hand − reserved
// for open orders; nothing here can take stock below what's reserved.

export type InventoryFilters = {
  q?: string;
  category?: string;
  brand?: string;
  status?: "ACTIVE" | "DRAFT";
  stock?: StockLevel;
  cost?: CostFilter;
  // Spec filters (socket, memory type…), keyed by spec field. Only used
  // with a category.
  specs?: Record<string, string>;
};

export async function listInventory(
  filters: InventoryFilters,
  settings: CostRules & { lowStockThreshold: number },
) {
  const lowThreshold = settings.lowStockThreshold;
  await requireAdmin();
  const q = filters.q?.trim();
  const where: Prisma.ProductWhereInput = {
    status: filters.status ?? { not: "ARCHIVED" },
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    ...(filters.brand ? { brand: { slug: filters.brand } } : {}),
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { name: { path: ["en"], string_contains: q } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const products = await db.product.findMany({
    where,
    orderBy: [{ category: { position: "asc" } }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      status: true,
      priceCents: true,
      specs: true,
      category: { select: { slug: true } },
      brand: { select: { name: true } },
      inventory: {
        where: { location: { code: DEFAULT_LOCATION } },
        select: { onHand: true, reserved: true, avgCostCents: true },
      },
    },
  });
  const lastCost = await lastPurchaseCosts(
    db,
    products.map((p) => p.id),
  );
  const rows = products.map((p) => {
    const i = p.inventory[0];
    const stock = {
      onHand: i?.onHand ?? 0,
      reserved: i?.reserved ?? 0,
      avgCostCents: i?.avgCostCents ?? null,
      lastCostCents: lastCost.get(p.id) ?? null,
    };
    const low = stock.onHand - stock.reserved <= lowThreshold;
    return { ...p, stock, low };
  });
  const stocked = rows.filter(
    (r) =>
      matchesStock(r, filters.stock ?? "all", lowThreshold) &&
      matchesCost(r, filters.cost ?? "all", settings),
  );

  const { rows: matching, facets } = filterBySpecs(filters.category, stocked, filters.specs ?? {});
  return { rows: matching, specFacets: facets };
}

// Choices for the filter dropdowns.
export async function inventoryFilterOptions() {
  await requireAdmin();
  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, select: { slug: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return { categories, brands };
}

export async function listMovements(sku?: string) {
  await requireAdmin();
  return db.inventoryMovement.findMany({
    where: {
      location: { code: DEFAULT_LOCATION },
      ...(sku ? { product: { sku: { equals: sku, mode: "insensitive" } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      product: { select: { sku: true, name: true } },
      actor: { select: { email: true } },
    },
  });
}

type Result = { ok: true } | { ok: false; error: string };

async function productBySku(sku: string) {
  return db.product.findFirst({
    where: { sku: { equals: sku.trim(), mode: "insensitive" } },
    select: { id: true, sku: true },
  });
}

export async function adjustStock(input: {
  sku: string;
  delta: number;
  reason: "ADJUSTMENT" | "WRITE_OFF";
  note: string;
  actorId: string;
}): Promise<Result> {
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 10_000) {
    return { ok: false, error: "Enter a change like 5 or -2." };
  }
  if (input.reason === "WRITE_OFF" && input.delta > 0) {
    return { ok: false, error: "A write-off removes stock: use a negative number." };
  }
  if (!input.note) return { ok: false, error: "Say why (e.g. count correction, damaged)." };
  const product = await productBySku(input.sku);
  if (!product) return { ok: false, error: `No product with SKU ${input.sku}.` };

  return db.$transaction(async (tx) => {
    const location = await tx.location.findUniqueOrThrow({ where: { code: DEFAULT_LOCATION } });
    const key = { productId: product.id, locationId: location.id };
    await tx.inventory.upsert({ where: { productId_locationId: key }, create: key, update: {} });
    // Never below what open orders have reserved.
    const changed = await tx.$executeRaw`
      UPDATE "Inventory" SET "onHand" = "onHand" + ${input.delta}
      WHERE "productId" = ${product.id} AND "locationId" = ${location.id}
        AND "onHand" + ${input.delta} >= reserved AND "onHand" + ${input.delta} >= 0`;
    if (changed === 0) {
      return {
        ok: false as const,
        error: "That would leave less stock than open orders have reserved.",
      };
    }
    await tx.inventoryMovement.create({
      data: {
        ...key,
        delta: input.delta,
        reason: input.reason,
        // Counted at the average; corrections don't change it.
        unitCostCents: await averageCost(tx, product.id, location.id),
        note: input.note,
        actorId: input.actorId,
      },
    });
    await audit(
      {
        actorId: input.actorId,
        action: input.reason === "WRITE_OFF" ? "inventory.write_off" : "inventory.adjust",
        entity: "inventory",
        entityId: product.id,
        summary: `${input.delta > 0 ? "+" : ""}${input.delta} × ${product.sku}: ${input.note}`,
      },
      tx,
    );
    return { ok: true as const };
  });
}
