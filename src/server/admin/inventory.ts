import "server-only";

import { Prisma, type LocationCode } from "@/generated/prisma/client";
import { filterBySpecs } from "@/lib/catalog/admin-spec-filter";
import { LOCATION_CODES } from "@/lib/store-config";
import {
  matchesCost,
  matchesStock,
  type CostFilter,
  type CostRules,
  type LocationFilter,
  type StockLevel,
} from "@/lib/inventory/filter";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { averageCost, lastPurchaseCosts, receiveUnits } from "@/server/inventory-cost";
import { requireAdmin } from "@/server/require-admin";

// Stock per location, manual adjustments and transfers between the stores.
// Available = on hand − reserved for open orders; nothing here can take a
// location below what's reserved.

export type InventoryFilters = {
  q?: string;
  category?: string;
  brand?: string;
  status?: "ACTIVE" | "DRAFT";
  location?: LocationFilter;
  stock?: StockLevel;
  cost?: CostFilter;
  // Spec filters (socket, memory type…), keyed by spec field. Only used
  // with a category, like the storefront's category pages.
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
        select: {
          onHand: true,
          reserved: true,
          avgCostCents: true,
          location: { select: { code: true } },
        },
      },
    },
  });
  const lastCost = await lastPurchaseCosts(
    db,
    products.map((p) => p.id),
  );
  const rows = products.map((p) => {
    const empty = (code: LocationCode) => ({
      onHand: 0,
      reserved: 0,
      avgCostCents: null as number | null,
      lastCostCents: lastCost.get(`${p.id}:${code}`) ?? null,
    });
    const stock = { TOR: empty("TOR"), MTL: empty("MTL") };
    for (const i of p.inventory) {
      stock[i.location.code] = {
        ...stock[i.location.code],
        onHand: i.onHand,
        reserved: i.reserved,
        avgCostCents: i.avgCostCents,
      };
    }
    const low = LOCATION_CODES.some(
      (code) => stock[code].onHand - stock[code].reserved <= lowThreshold,
    );
    return { ...p, stock, low };
  });
  const stocked = rows.filter(
    (r) =>
      matchesStock(r, filters.stock ?? "all", filters.location ?? "all", lowThreshold) &&
      matchesCost(r, filters.cost ?? "all", filters.location ?? "all", settings),
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
    where: sku ? { product: { sku: { equals: sku, mode: "insensitive" } } } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      product: { select: { sku: true, name: true } },
      location: { select: { code: true } },
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

export async function transferStock(input: {
  sku: string;
  from: LocationCode;
  to: LocationCode;
  quantity: number;
  note: string;
  actorId: string;
}): Promise<Result> {
  if (input.from === input.to) return { ok: false, error: "Pick two different locations." };
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 1000) {
    return { ok: false, error: "Enter how many units to move (1 or more)." };
  }
  const product = await productBySku(input.sku);
  if (!product) return { ok: false, error: `No product with SKU ${input.sku}.` };

  return db.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.location.findUniqueOrThrow({ where: { code: input.from } }),
      tx.location.findUniqueOrThrow({ where: { code: input.to } }),
    ]);
    // Guarded: only succeeds if the units are free (not reserved for orders).
    const moved = await tx.$executeRaw`
      UPDATE "Inventory" SET "onHand" = "onHand" - ${input.quantity}
      WHERE "productId" = ${product.id} AND "locationId" = ${from.id}
        AND "onHand" - reserved >= ${input.quantity}`;
    if (moved === 0) {
      return { ok: false as const, error: `Not enough free stock in ${input.from} to move.` };
    }
    // The units carry the sending store's average cost with them.
    const unitCostCents = await averageCost(tx, product.id, from.id);
    await receiveUnits(tx, {
      productId: product.id,
      locationId: to.id,
      quantity: input.quantity,
      unitCostCents,
    });
    const note = input.note || null;
    await tx.inventoryMovement.createMany({
      data: [
        {
          productId: product.id,
          locationId: from.id,
          delta: -input.quantity,
          reason: "TRANSFER",
          unitCostCents,
          note: `To ${input.to}${note ? `: ${note}` : ""}`,
          actorId: input.actorId,
        },
        {
          productId: product.id,
          locationId: to.id,
          delta: input.quantity,
          reason: "TRANSFER",
          unitCostCents,
          note: `From ${input.from}${note ? `: ${note}` : ""}`,
          actorId: input.actorId,
        },
      ],
    });
    await audit(
      {
        actorId: input.actorId,
        action: "inventory.transfer",
        entity: "inventory",
        entityId: product.id,
        summary: `Moved ${input.quantity} × ${product.sku} from ${input.from} to ${input.to}${note ? ` (${note})` : ""}`,
      },
      tx,
    );
    return { ok: true as const };
  });
}

export async function adjustStock(input: {
  sku: string;
  location: LocationCode;
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
    const location = await tx.location.findUniqueOrThrow({ where: { code: input.location } });
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
        summary: `${input.delta > 0 ? "+" : ""}${input.delta} × ${product.sku} in ${input.location}: ${input.note}`,
      },
      tx,
    );
    return { ok: true as const };
  });
}
