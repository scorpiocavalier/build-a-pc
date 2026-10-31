"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseCheckoutForm, type CheckoutErrorKey } from "@/lib/checkout/checkout-input";
import { saveAddress } from "@/server/account/addresses";
import { clearCart, getCheckoutCart } from "@/server/cart";
import { getCustomer } from "@/server/customer";
import { placeOrder } from "@/server/orders/lifecycle";
import { hitByIp } from "@/server/rate-limit";

export type CheckoutState = {
  // Field name → key under "Checkout.errors".
  errors?: Record<string, CheckoutErrorKey>;
  // Problem with the whole order → key under "Checkout.errors".
  formError?: "stock" | "payment" | "empty" | "method" | "fulfilment" | "tooMany";
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
  // Each order holds stock, so a script placing many could empty the shelves.
  if (!(await hitByIp("checkout"))) return { formError: "tooMany", values: raw };

  const customer = await getCustomer();
  const result = await placeOrder(parsed.input, await getCheckoutCart(), locale, customer?.id);
  if (!result.ok) {
    return {
      formError: result.error === "noDelivery" ? "fulfilment" : result.error,
      values: raw,
    };
  }

  const address = result.order.deliveryAddress;
  if (customer && address && raw.saveAddress === "on") {
    await saveAddress(customer.id, {
      name: parsed.input.name,
      phone: parsed.input.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      province: address.province as Parameters<typeof saveAddress>[1]["province"],
      postalCode: address.postalCode,
      isDefault: false,
    });
  }

  await clearCart();
  // Re-render the shared layout too, so the header's cart count resets.
  refresh();
  redirect(result.redirectTo);
}
