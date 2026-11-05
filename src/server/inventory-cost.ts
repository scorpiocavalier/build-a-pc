import "server-only";

import { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// Average cost per unit at one location, or null when unknown.
export async function averageCost(
  tx: Tx,
  productId: string,
  locationId: string,
): Promise<number | null> {
  const row = await tx.inventory.findUnique({
    where: { productId_locationId: { productId, locationId } },
    select: { avgCostCents: true },
  });
  return row?.avgCostCents ?? null;
}

// Adds units to a location and folds their cost into its moving weighted
// average in one statement, so concurrent receipts can't lose an update.
// A null cost adds the units without changing the average.
export async function receiveUnits(
  tx: Tx,
  input: { productId: string; locationId: string; quantity: number; unitCostCents: number | null },
) {
  const { productId, locationId, quantity, unitCostCents: cost } = input;
  await tx.inventory.upsert({
    where: { productId_locationId: { productId, locationId } },
    create: { productId, locationId },
    update: {},
  });
  // Mirrors weightedAverage() in src/lib/inventory/cost.ts.
  await tx.$executeRaw`
    UPDATE "Inventory" SET
      "avgCostCents" = CASE
        WHEN ${cost}::float8 IS NULL THEN "avgCostCents"
        WHEN "avgCostCents" IS NULL OR "onHand" <= 0 THEN ${cost}::float8
        ELSE ("onHand" * "avgCostCents" + ${quantity} * ${cost}::float8) / ("onHand" + ${quantity})
      END,
      "onHand" = "onHand" + ${quantity}
    WHERE "productId" = ${productId} AND "locationId" = ${locationId}`;
}

// Landed cost of each product's latest purchase per location, keyed
// "productId:TOR" / "productId:MTL".
export async function lastPurchaseCosts(
  client: Tx,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await client.$queryRaw<{ productId: string; code: string; cost: number }[]>`
    SELECT DISTINCT ON (m."productId", m."locationId")
           m."productId", l.code::text AS code, m."unitCostCents" AS cost
    FROM "InventoryMovement" m
    JOIN "Location" l ON l.id = m."locationId"
    WHERE m.reason = 'PURCHASE' AND m."unitCostCents" IS NOT NULL
      AND m."productId" IN (${Prisma.join(productIds)})
    ORDER BY m."productId", m."locationId", m."createdAt" DESC`;
  return new Map(rows.map((r) => [`${r.productId}:${r.code}`, r.cost]));
}
