import { connection } from "next/server";

import { auth } from "@/auth";
import { db } from "@/server/db";

// "Download my data" (PIPEDA / Quebec Law 25 access requests): everything
// stored about the signed-in customer, as JSON.
export async function GET() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return new Response("Sign in first", { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      locale: true,
      createdAt: true,
      addresses: {
        select: {
          name: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          province: true,
          postalCode: true,
          isDefault: true,
        },
      },
      wishlist: { select: { createdAt: true, product: { select: { sku: true, name: true } } } },
      builds: {
        select: {
          name: true,
          shareId: true,
          updatedAt: true,
          items: { select: { slot: true, quantity: true, product: { select: { sku: true } } } },
        },
      },
      orders: {
        orderBy: { placedAt: "desc" },
        select: {
          number: true,
          placedAt: true,
          status: true,
          name: true,
          email: true,
          phone: true,
          fulfilment: true,
          deliveryAddress: true,
          paymentMethod: true,
          paymentStatus: true,
          totalCents: true,
          paidCents: true,
          lines: { select: { sku: true, name: true, quantity: true, unitPriceCents: true } },
          returns: {
            select: { number: true, status: true, reason: true, details: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!user) return new Response("Not found", { status: 404 });

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), store: "Astral Tech Gaming", ...user },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="astral-tech-gaming-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
