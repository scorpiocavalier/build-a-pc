import "server-only";

import { summarySelect, toSummary } from "@/server/catalog/queries";
import { db } from "@/server/db";

export async function listWishlist(userId: string) {
  const rows = await db.wishlistItem.findMany({
    where: { userId, product: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    select: { product: { select: summarySelect } },
  });
  return rows.map((row) => toSummary(row.product));
}

export async function isWishlisted(userId: string, productId: string) {
  const row = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { productId: true },
  });
  return !!row;
}

// Adds the product, or removes it if it's already saved. Returns the new state.
export async function toggleWishlist(userId: string, productId: string): Promise<boolean> {
  const { count } = await db.wishlistItem.deleteMany({ where: { userId, productId } });
  if (count) return false;
  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!product) return false;
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
  return true;
}

export async function removeFromWishlist(userId: string, productId: string) {
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
}
