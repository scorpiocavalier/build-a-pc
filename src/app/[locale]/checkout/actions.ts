"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseCheckoutForm, type CheckoutErrorKey } from "@/lib/checkout/checkout-input";
import { clearCart, getCheckoutCart } from "@/server/cart";
import { placeOrder } from "@/server/orders/lifecycle";

export type CheckoutState = {
  // Field name → key under "Checkout.errors".
  errors?: Record<string, CheckoutErrorKey>;
  // Problem with the whole order → key under "Checkout.errors".
  formError?: "stock" | "payment" | "empty" | "method" | "fulfilment";
  values?: Record<string, string>;
};

export async function placeOrderAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData)
    if (typeof value === "string" && !key.startsWith("$")) raw[key] = value;
  const locale = raw.locale === "fr" ? "fr" : "en";

  const parsed = parseCheckoutForm(raw, new Date());
  if (!parsed.ok) return { errors: parsed.errors, values: raw };

  const result = await placeOrder(parsed.input, await getCheckoutCart(), locale);
  if (!result.ok) {
    return {
      formError: result.error === "noDelivery" ? "fulfilment" : result.error,
      values: raw,
    };
  }

  await clearCart();
  // Re-render the shared layout too, so the header's cart count resets.
  refresh();
  redirect(result.redirectTo);
}
