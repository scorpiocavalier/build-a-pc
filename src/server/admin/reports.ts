import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ReportRange } from "@/lib/reports/range";
import { DEFAULT_LOCATION } from "@/lib/store-config";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";

// Numbers for /admin/reports. Money in is counted when a payment arrives and
// money out when a refund is made, so a period's net is what really moved.
// Only the store's numbers count (the database may still hold another store's
// history from when the site ran two).

export async function getReport(range: ReportRange) {
  await requireAdmin();
  const { start, end } = range;
  const loc = Prisma.sql`AND l.code = ${DEFAULT_LOCATION}::"LocationCode"`;

  const [received, refunded, sales, topProducts, stockValue, awaitingBalance, profit] =
    await Promise.all([
      db.$queryRaw<{ method: string; cents: bigint; count: bigint }[]>`
      SELECT p.method::text AS method,
             SUM(p."amountCents")::bigint AS cents, COUNT(*)::bigint AS count
      FROM "Payment" p
      JOIN "Order" o ON o.id = p."orderId"
      JOIN "Location" l ON l.id = o."locationId"
      WHERE p.status IN ('SUCCEEDED', 'REFUNDED')
        AND p."receivedAt" >= ${start} AND p."receivedAt" < ${end} ${loc}
      GROUP BY p.method`,
      db.$queryRaw<{ method: string; cents: bigint; fees: bigint }[]>`
      SELECT r.method::text AS method,
             SUM(r."amountCents")::bigint AS cents, SUM(r."restockingFeeCents")::bigint AS fees
      FROM "Refund" r
      JOIN "Order" o ON o.id = r."orderId"
      JOIN "Location" l ON l.id = o."locationId"
      WHERE r."createdAt" >= ${start} AND r."createdAt" < ${end} ${loc}
      GROUP BY r.method`,
      db.$queryRaw<{ orders: bigint; total: bigint; tax: bigint; assembled: bigint }[]>`
      SELECT COUNT(*)::bigint AS orders,
             COALESCE(SUM(o."totalCents"), 0)::bigint AS total,
             COALESCE(SUM(o."taxCents"), 0)::bigint AS tax,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM "OrderLine" ol
               WHERE ol."orderId" = o.id AND ol."buildGroup" IS NOT NULL
             ))::bigint AS assembled
      FROM "Order" o
      JOIN "Location" l ON l.id = o."locationId"
      WHERE o.status <> 'CANCELLED'
        AND o."placedAt" >= ${start} AND o."placedAt" < ${end} ${loc}`,
      db.$queryRaw<
        {
          sku: string;
          name: Prisma.JsonValue;
          units: bigint;
          cents: bigint;
          costedCents: bigint;
          cost: number | null;
        }[]
      >`
      SELECT ol.sku, MAX(ol.name::text)::jsonb AS name,
             SUM(ol.quantity)::bigint AS units,
             SUM(ol.quantity * ol."unitPriceCents")::bigint AS cents,
             -- Profit only counts lines whose cost is known (handed over).
             COALESCE(SUM(ol.quantity * ol."unitPriceCents")
               FILTER (WHERE ol."unitCostCents" IS NOT NULL), 0)::bigint AS "costedCents",
             SUM(ol.quantity * ol."unitCostCents") AS cost
      FROM "OrderLine" ol
      JOIN "Order" o ON o.id = ol."orderId"
      JOIN "Location" l ON l.id = o."locationId"
      WHERE o.status <> 'CANCELLED'
        AND o."placedAt" >= ${start} AND o."placedAt" < ${end} ${loc}
      GROUP BY ol.sku
      ORDER BY cents DESC
      LIMIT 15`,
      // Today's stock, at selling prices and at average cost.
      db.$queryRaw<{ units: bigint; cents: bigint; cost: number | null; uncosted: bigint }[]>`
      SELECT COALESCE(SUM(i."onHand"), 0)::bigint AS units,
             COALESCE(SUM(i."onHand" * p."priceCents"), 0)::bigint AS cents,
             SUM(i."onHand" * i."avgCostCents") AS cost,
             COALESCE(SUM(i."onHand") FILTER (WHERE i."avgCostCents" IS NULL), 0)::bigint
               AS uncosted
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      JOIN "Location" l ON l.id = i."locationId"
      WHERE p.status <> 'ARCHIVED' AND i."onHand" > 0 ${loc}`,
      // Deposit paid, balance still owing.
      db.order.findMany({
        where: {
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          depositCents: { gt: 0 },
          paidCents: { gt: 0 },
          location: { code: DEFAULT_LOCATION },
        },
        orderBy: { placedAt: "asc" },
        select: {
          id: true,
          number: true,
          name: true,
          status: true,
          totalCents: true,
          paidCents: true,
          depositCents: true,
        },
      }),
      // Gross profit on goods handed over in the period, at the cost recorded
      // on each line at handover.
      db.$queryRaw<{ sales: bigint; cost: number | null; uncosted: bigint }[]>`
      SELECT COALESCE(SUM(ol.quantity * ol."unitPriceCents")
               FILTER (WHERE ol."unitCostCents" IS NOT NULL), 0)::bigint AS sales,
             SUM(ol.quantity * ol."unitCostCents") AS cost,
             COUNT(*) FILTER (WHERE ol."unitCostCents" IS NULL)::bigint AS uncosted
      FROM "OrderLine" ol
      JOIN "Order" o ON o.id = ol."orderId"
      JOIN "Location" l ON l.id = o."locationId"
      WHERE o.status = 'COMPLETED'
        AND o."completedAt" >= ${start} AND o."completedAt" < ${end} ${loc}`,
    ]);

  const n = (v: bigint | null | undefined) => Number(v ?? 0);
  const receivedCents = received.reduce((s, r) => s + n(r.cents), 0);
  const refundedCents = refunded.reduce((s, r) => s + n(r.cents), 0);
  const s = sales[0];
  return {
    received: received.map((r) => ({ ...r, cents: n(r.cents), count: n(r.count) })),
    refunded: refunded.map((r) => ({ ...r, cents: n(r.cents), fees: n(r.fees) })),
    receivedCents,
    refundedCents,
    netCents: receivedCents - refundedCents,
    feesCents: refunded.reduce((sum, r) => sum + n(r.fees), 0),
    sales: {
      orders: n(s?.orders),
      totalCents: n(s?.total),
      taxCents: n(s?.tax),
      assembled: n(s?.assembled),
      averageCents: n(s?.orders) ? Math.round(n(s?.total) / n(s?.orders)) : 0,
    },
    topProducts: topProducts.map((p) => ({
      ...p,
      units: n(p.units),
      cents: n(p.cents),
      costedCents: n(p.costedCents),
      // Null when none of the product's lines has a cost yet.
      profitCents: p.cost === null ? null : n(p.costedCents) - Number(p.cost),
    })),
    stockValue: {
      units: n(stockValue[0]?.units),
      cents: n(stockValue[0]?.cents),
      costCents: Number(stockValue[0]?.cost ?? 0),
      uncosted: n(stockValue[0]?.uncosted),
    },
    profit: {
      salesCents: n(profit[0]?.sales),
      costCents: Number(profit[0]?.cost ?? 0),
      profitCents: n(profit[0]?.sales) - Number(profit[0]?.cost ?? 0),
      uncostedLines: n(profit[0]?.uncosted),
    },
    awaitingBalance: awaitingBalance.filter(
      (o) => o.paidCents >= o.depositCents && o.paidCents < o.totalCents,
    ),
  };
}
