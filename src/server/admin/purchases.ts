import "server-only";

import type { LocationCode } from "@/generated/prisma/client";
import { landedUnitCosts, type CostSplit } from "@/lib/inventory/cost";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { averageCost, receiveUnits } from "@/server/inventory-cost";
import { requireAdmin } from "@/server/require-admin";

// Stock bought from suppliers. Receiving a purchase adds the units to the
// location and updates that location's moving weighted average cost.

export type PurchaseInput = {
  location: LocationCode;
  supplier: string;
  reference: string;
  purchasedAt: Date;
  shippingCents: number;
  dutiesCents: number;
  otherCents: number;
  split: CostSplit;
  note: string;
  lines: { sku: string; quantity: number; unitCostCents: number }[];
  actorId: string;
};

type Result = { ok: true; number: number } | { ok: false; error: string };

const MAX_CENTS = 100_000_000; // $1,000,000

const validCents = (cents: number) => Number.isInteger(cents) && cents >= 0 && cents <= MAX_CENTS;

export async function receivePurchase(input: PurchaseInput): Promise<Result> {
  if (!input.supplier) return { ok: false, error: "Enter the supplier." };
  const tomorrow = new Date(Date.now() + 86_400_000);
  if (Number.isNaN(input.purchasedAt.getTime()) || input.purchasedAt > tomorrow) {
    return { ok: false, error: "Enter the purchase date (not in the future)." };
  }
  const fees = [
    ["Shipping", input.shippingCents],
    ["Duties", input.dutiesCents],
    ["Other fees", input.otherCents],
  ] as const;
  for (const [label, cents] of fees) {
    if (!validCents(cents)) {
      return { ok: false, error: `${label}: enter an amount like 25.00 (or leave it empty).` };
    }
  }
  if (input.lines.length === 0) return { ok: false, error: "Add at least one product." };
  const seen = new Set<string>();
  for (const [i, line] of input.lines.entries()) {
    const row = `Line ${i + 1}`;
    if (!line.sku) return { ok: false, error: `${row}: enter a SKU.` };
    const key = line.sku.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `${line.sku} is listed twice; combine the lines.` };
    }
    seen.add(key);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10_000) {
      return { ok: false, error: `${row}: enter how many units (1 or more).` };
    }
    if (!validCents(line.unitCostCents)) {
      return { ok: false, error: `${row}: enter the unit cost, like 129.99.` };
    }
  }

  const products = await db.product.findMany({
    where: {
      OR: input.lines.map((l) => ({ sku: { equals: l.sku, mode: "insensitive" as const } })),
    },
    select: { id: true, sku: true },
  });
  const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
  const missing = input.lines.find((l) => !bySku.has(l.sku.toLowerCase()));
  if (missing) return { ok: false, error: `No product with SKU ${missing.sku}.` };
  const productId = (sku: string) => bySku.get(sku.toLowerCase())!.id;

  const extra = input.shippingCents + input.dutiesCents + input.otherCents;
  const landed = landedUnitCosts(input.lines, extra, input.split);

  return db.$transaction(async (tx) => {
    const location = await tx.location.findUniqueOrThrow({ where: { code: input.location } });
    const purchase = await tx.purchase.create({
      data: {
        locationId: location.id,
        supplier: input.supplier,
        reference: input.reference || null,
        purchasedAt: input.purchasedAt,
        shippingCents: input.shippingCents,
        dutiesCents: input.dutiesCents,
        otherCents: input.otherCents,
        split: input.split,
        note: input.note || null,
        actorId: input.actorId,
        lines: {
          create: input.lines.map((l, i) => ({
            productId: productId(l.sku),
            quantity: l.quantity,
            unitCostCents: l.unitCostCents,
            landedUnitCostCents: landed[i],
          })),
        },
      },
    });
    for (const [i, line] of input.lines.entries()) {
      const id = productId(line.sku);
      await receiveUnits(tx, {
        productId: id,
        locationId: location.id,
        quantity: line.quantity,
        unitCostCents: landed[i],
      });
      await tx.inventoryMovement.create({
        data: {
          productId: id,
          locationId: location.id,
          delta: line.quantity,
          reason: "PURCHASE",
          unitCostCents: landed[i],
          note: `PO-${purchase.number} · ${input.supplier}`,
          actorId: input.actorId,
        },
      });
    }
    const units = input.lines.reduce((s, l) => s + l.quantity, 0);
    await audit(
      {
        actorId: input.actorId,
        action: "purchase.receive",
        entity: "purchase",
        entityId: purchase.id,
        summary: `PO-${purchase.number}: ${units} units from ${input.supplier} into ${input.location}`,
      },
      tx,
    );
    return { ok: true as const, number: purchase.number };
  });
}

// Sets a location's average cost by hand: for stock that was there before
// purchases were recorded, or to correct a mistake.
export async function setAverageCost(input: {
  sku: string;
  location: LocationCode;
  costCents: number;
  note: string;
  actorId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validCents(input.costCents)) {
    return { ok: false, error: "Enter the cost per unit, like 129.99." };
  }
  const product = await db.product.findFirst({
    where: { sku: { equals: input.sku.trim(), mode: "insensitive" } },
    select: { id: true, sku: true },
  });
  if (!product) return { ok: false, error: `No product with SKU ${input.sku}.` };
  return db.$transaction(async (tx) => {
    const location = await tx.location.findUniqueOrThrow({ where: { code: input.location } });
    const before = await averageCost(tx, product.id, location.id);
    const key = { productId: product.id, locationId: location.id };
    await tx.inventory.upsert({
      where: { productId_locationId: key },
      create: { ...key, avgCostCents: input.costCents },
      update: { avgCostCents: input.costCents },
    });
    const dollars = (c: number | null) => (c === null ? "unknown" : `$${(c / 100).toFixed(2)}`);
    const note = input.note ? ` (${input.note})` : "";
    await audit(
      {
        actorId: input.actorId,
        action: "inventory.set_cost",
        entity: "inventory",
        entityId: product.id,
        summary: `Average cost of ${product.sku} in ${input.location}: ${dollars(before)} → ${dollars(input.costCents)}${note}`,
      },
      tx,
    );
    return { ok: true as const };
  });
}

export async function listPurchases(take = 30) {
  await requireAdmin();
  return db.purchase.findMany({
    orderBy: [{ purchasedAt: "desc" }, { number: "desc" }],
    take,
    include: {
      location: { select: { code: true } },
      actor: { select: { email: true } },
      lines: {
        include: {
          product: { select: { sku: true, name: true, brand: { select: { name: true } } } },
        },
      },
    },
  });
}
