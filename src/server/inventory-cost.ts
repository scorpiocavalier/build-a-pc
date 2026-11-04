import "server-only";

import type { Prisma } from "@/generated/prisma/client";

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
