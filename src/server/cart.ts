import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { LOCATION_CODES, type LocationCode } from "@/lib/catalog/product-input";
import type { LocalizedText } from "@/lib/localized";
import { db } from "@/server/db";
import { publicUrl } from "@/server/storage";

// The cart lives in the database; the browser only holds a random token in an
// httpOnly cookie. Carts are per-browser until accounts arrive (Phase 4).

export const CART_COOKIE = "atg_cart";
export const MAX_LINE_QUANTITY = 10;

export type CartLineView = {
  productId: string;
  slug: string;
  sku: string;
  name: LocalizedText;
  brand: string;
  categorySlug: string;
  unitPriceCents: number;
  quantity: number;
  imageUrl: string | null;
  available: Record<LocationCode, number>;
};

async function readToken(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

async function ensureCart(): Promise<string> {
  const token = await readToken();
  if (token) {
    const cart = await db.cart.findUnique({ where: { token }, select: { id: true } });
    if (cart) return cart.id;
  }
  const newToken = randomBytes(24).toString("base64url");
  const cart = await db.cart.create({ data: { token: newToken } });
  (await cookies()).set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return cart.id;
}

export async function getCartLines(): Promise<CartLineView[]> {
  const token = await readToken();
  if (!token) return [];
  const cart = await db.cart.findUnique({
    where: { token },
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            include: {
              brand: true,
              category: true,
              images: { orderBy: { position: "asc" }, take: 1 },
              inventory: { include: { location: true } },
            },
          },
        },
      },
    },
  });
  if (!cart) return [];

  return cart.lines
    .filter((line) => line.product.status === "ACTIVE")
    .map(({ product, quantity }) => {
      const available = Object.fromEntries(LOCATION_CODES.map((c) => [c, 0])) as Record<
        LocationCode,
        number
      >;
      for (const stock of product.inventory) {
        available[stock.location.code] = Math.max(0, stock.onHand - stock.reserved);
      }
      return {
        productId: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name as LocalizedText,
        brand: product.brand.name,
        categorySlug: product.category.slug,
        unitPriceCents: product.priceCents,
        quantity,
        imageUrl: product.images[0] ? publicUrl(product.images[0].key) : null,
        available,
      };
    });
}

export async function getCartCount(): Promise<number> {
  const token = await readToken();
  if (!token) return 0;
  const result = await db.cartLine.aggregate({
    where: { cart: { token }, product: { status: "ACTIVE" } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function addToCart(productId: string, quantity: number) {
  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!product) return;
  const cartId = await ensureCart();
  const existing = await db.cartLine.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  const next = Math.min(MAX_LINE_QUANTITY, (existing?.quantity ?? 0) + quantity);
  await db.cartLine.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: next },
    update: { quantity: next },
  });
}

export async function setLineQuantity(productId: string, quantity: number) {
  const token = await readToken();
  if (!token) return;
  const cart = await db.cart.findUnique({ where: { token }, select: { id: true } });
  if (!cart) return;
  const key = { cartId_productId: { cartId: cart.id, productId } };
  if (quantity <= 0) await db.cartLine.deleteMany({ where: { cartId: cart.id, productId } });
  else
    await db.cartLine.update({
      where: key,
      data: { quantity: Math.min(quantity, MAX_LINE_QUANTITY) },
    });
}

export async function clearCart() {
  const token = await readToken();
  if (!token) return;
  await db.cartLine.deleteMany({ where: { cart: { token } } });
}
