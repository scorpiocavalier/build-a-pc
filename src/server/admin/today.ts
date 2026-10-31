import "server-only";

import type { LocationCode, Prisma } from "@/generated/prisma/client";
import { storeDayBounds } from "@/lib/store-time";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";
import { getSettings } from "@/server/settings";

// The admin "Today" view: what each location needs to do now.

const orderSelect = {
  id: true,
  number: true,
  name: true,
  status: true,
  fulfilment: true,
  paymentMethod: true,
  paymentStatus: true,
  totalCents: true,
  paidCents: true,
  depositCents: true,
  assemblyCents: true,
  holdUntil: true,
  scheduledFor: true,
  requestedWindow: true,
  location: { select: { code: true } },
} satisfies Prisma.OrderSelect;

export type TodayOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export async function getToday(location: LocationCode | null) {
  // Checked first: it also marks this as request-time work, so reading the
  // clock below doesn't happen while prerendering.
  await requireAdmin();
  const now = new Date();
  const settings = await getSettings();
  const at: Prisma.OrderWhereInput = location ? { location: { code: location } } : {};
  const { start, end } = storeDayBounds(now);
  const open = { notIn: ["COMPLETED", "CANCELLED"] } as Prisma.EnumOrderStatusFilter;

  const [toConfirm, toAssemble, scheduledToday, unscheduled, returns, lowStock, counts] =
    await Promise.all([
      // Waiting on an e-Transfer, a cash confirmation or a deposit.
      db.order.findMany({
        where: { ...at, status: "PLACED", paymentMethod: { not: "CARD" } },
        orderBy: { holdUntil: "asc" },
        select: orderSelect,
        take: 50,
      }),
      db.order.findMany({
        where: { ...at, assemblyCents: { gt: 0 }, status: { in: ["CONFIRMED", "ASSEMBLING"] } },
        orderBy: { placedAt: "asc" },
        select: orderSelect,
        take: 50,
      }),
      db.order.findMany({
        where: { ...at, status: open, scheduledFor: { gte: start, lt: end } },
        orderBy: { scheduledFor: "asc" },
        select: orderSelect,
      }),
      db.order.findMany({
        where: {
          ...at,
          status: { in: ["CONFIRMED", "ASSEMBLING", "READY"] },
          scheduledFor: null,
        },
        orderBy: { placedAt: "asc" },
        select: orderSelect,
        take: 50,
      }),
      db.returnRequest.groupBy({
        by: ["status"],
        where: {
          status: { in: ["REQUESTED", "APPROVED"] },
          ...(location ? { order: { location: { code: location } } } : {}),
        },
        _count: true,
      }),
      db.inventory.findMany({
        where: {
          ...(location ? { location: { code: location } } : {}),
          product: { status: "ACTIVE" },
        },
        select: {
          onHand: true,
          reserved: true,
          location: { select: { code: true } },
          product: { select: { id: true, sku: true, name: true } },
        },
      }),
      db.order.groupBy({ by: ["status"], where: { ...at, status: open }, _count: true }),
    ]);

  const low = lowStock
    .map((row) => ({ ...row, available: row.onHand - row.reserved }))
    .filter((row) => row.available <= settings.lowStockThreshold)
    .sort((a, b) => a.available - b.available);
  const countOf = (status: string) => counts.find((c) => c.status === status)?._count ?? 0;
  const returnsOf = (status: string) => returns.find((r) => r.status === status)?._count ?? 0;

  return {
    counts: {
      placed: countOf("PLACED"),
      toPrepare: countOf("CONFIRMED") + countOf("ASSEMBLING"),
      ready: countOf("READY") + countOf("OUT_FOR_DELIVERY"),
    },
    toConfirm,
    toAssemble,
    scheduledToday,
    unscheduled,
    returns: { toReview: returnsOf("REQUESTED"), toReceive: returnsOf("APPROVED") },
    lowStock: low,
    lowStockThreshold: settings.lowStockThreshold,
  };
}
