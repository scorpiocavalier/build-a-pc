"use server";

import { refresh } from "next/cache";

import { addToCart, setLineQuantity } from "@/server/cart";

export type AddToCartState = { added?: number };

export async function addToCartAction(
  _prev: AddToCartState,
  formData: FormData,
): Promise<AddToCartState> {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Math.max(1, Math.min(10, Number(formData.get("quantity")) || 1));
  await addToCart(productId, quantity);
  refresh();
  return { added: quantity };
}

export async function updateCartLineAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity"));
  if (!productId || !Number.isInteger(quantity)) return;
  await setLineQuantity(productId, quantity);
  refresh();
}
