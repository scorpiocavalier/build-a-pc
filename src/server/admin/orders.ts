import "server-only";

import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { parseOrderNumber } from "@/lib/checkout/order-number";
import { db } from "@/server/db";
import { loadOrder } from "@/server/orders/view";
import { requireAdmin } from "@/server/require-admin";

const STATUSES: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

export type AdminOrderFilters = { status?: string; q?: string; location?: string };

export async function listAdminOrders(filters: AdminOrderFilters) {
  await requireAdmin();
  const where: Prisma.OrderWhereInput = {};
  if (filters.status === "open") where.status = { notIn: ["COMPLETED", "CANCELLED"] };
  else if (STATUSES.includes(filters.status as OrderStatus))
    where.status = filters.status as OrderStatus;
  if (filters.location === "TOR" || filters.location === "MTL")
    where.location = { code: filters.location };
  const q = filters.q?.trim();
  if (q) {
    const number = parseOrderNumber(q);
    where.OR = [
      ...(number ? [{ number }] : []),
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  return db.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    take: 200,
    include: { location: { select: { code: true } }, _count: { select: { lines: true } } },
  });
}

export async function getAdminOrder(id: string) {
  await requireAdmin();
  return loadOrder(id);
}

export async function getOrderCounts() {
  await requireAdmin();
  const [placed, toPrepare, ready] = await Promise.all([
    db.order.count({ where: { status: "PLACED" } }),
    db.order.count({ where: { status: "CONFIRMED" } }),
    db.order.count({ where: { status: { in: ["READY", "OUT_FOR_DELIVERY"] } } }),
  ]);
  return { placed, toPrepare, ready };
}
