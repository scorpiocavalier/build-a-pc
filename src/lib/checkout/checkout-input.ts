import { z } from "zod";

import type { Fulfilment, PaymentMethod } from "@/generated/prisma/enums";
import type { LocationCode } from "@/lib/catalog/product-input";
import { LOCATION_CODES } from "@/lib/catalog/product-input";

import { normalizePostalCode } from "./postal";
import { parseWindow, type RequestedWindow } from "./windows";

// Validates the checkout form. Error values are keys under
// "Checkout.errors" in the message files, so the page can translate them.

export type CheckoutErrorKey =
  "required" | "email" | "phone" | "window" | "terms" | "method" | "fulfilment";

export type CheckoutInput = {
  fulfilment: Fulfilment;
  // Pickup: the chosen location. Delivery: resolved from the postal code later.
  locationCode: LocationCode | null;
  address: { line1: string; line2: string; city: string; postalCode: string } | null;
  window: RequestedWindow;
  name: string;
  email: string;
  phone: string;
  method: PaymentMethod;
  notes: string;
};

export type CheckoutParseResult =
  { ok: true; input: CheckoutInput } | { ok: false; errors: Record<string, CheckoutErrorKey> };

const email = z.email();

// North American numbers: 10 digits, optionally with a leading 1.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function parseCheckoutForm(
  raw: Record<string, string | undefined>,
  now: Date,
): CheckoutParseResult {
  const errors: Record<string, CheckoutErrorKey> = {};
  const value = (key: string) => (raw[key] ?? "").trim();

  const fulfilment = value("fulfilment") as Fulfilment;
  let locationCode: LocationCode | null = null;
  let address: CheckoutInput["address"] = null;
  if (fulfilment === "PICKUP") {
    const code = value("location") as LocationCode;
    if ((LOCATION_CODES as readonly string[]).includes(code)) locationCode = code;
    else errors.fulfilment = "fulfilment";
  } else if (fulfilment === "DELIVERY") {
    const postalCode = normalizePostalCode(value("postalCode"));
    if (!postalCode) errors.fulfilment = "fulfilment";
    if (!value("line1")) errors.line1 = "required";
    if (!value("city")) errors.city = "required";
    address = {
      line1: value("line1"),
      line2: value("line2"),
      city: value("city"),
      postalCode: postalCode ?? "",
    };
  } else {
    errors.fulfilment = "fulfilment";
  }

  const window = parseWindow(value("date"), value("slot"), now);
  if (!window) errors.window = "window";

  const name = value("name");
  if (!name) errors.name = "required";
  const emailValue = value("email").toLowerCase();
  if (!emailValue) errors.email = "required";
  else if (!email.safeParse(emailValue).success) errors.email = "email";
  const phone = normalizePhone(value("phone"));
  if (!value("phone")) errors.phone = "required";
  else if (!phone) errors.phone = "phone";

  const method = value("method") as PaymentMethod;
  if (!["CARD", "ETRANSFER", "CASH"].includes(method)) errors.method = "method";
  if (raw.terms !== "on") errors.terms = "terms";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      fulfilment,
      locationCode,
      address,
      window: window!,
      name: name.slice(0, 120),
      email: emailValue,
      phone: phone!,
      method,
      notes: value("notes").slice(0, 1000),
    },
  };
}
