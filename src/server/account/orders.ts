import "server-only";

import { db } from "@/server/db";

// A customer's orders, newest first, for /account/orders.
export async function listMyOrders(userId: string, take?: number) {
  return db.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    take,
    select: {
      id: true,
      number: true,
      accessToken: true,
      status: true,
      paymentStatus: true,
      fulfilment: true,
      totalCents: true,
      placedAt: true,
      _count: { select: { lines: true } },
      returns: { select: { number: true, status: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export type MyOrder = Awaited<ReturnType<typeof listMyOrders>>[number];
