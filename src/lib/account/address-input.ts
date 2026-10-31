import { normalizePhone } from "@/lib/checkout/checkout-input";
import { normalizePostalCode } from "@/lib/checkout/postal";

// Saved delivery addresses. Errors are keys under "Account.errors".

export const PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;
export type Province = (typeof PROVINCES)[number];

export type AddressInput = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  province: Province;
  postalCode: string;
  isDefault: boolean;
};

export type AddressErrorKey = "required" | "phone" | "postalCode" | "province";

export function parseAddressForm(
  raw: Record<string, string | undefined>,
):
  | { ok: true; input: AddressInput }
  | { ok: false; errors: Partial<Record<keyof AddressInput, AddressErrorKey>> } {
  const value = (key: string) => (raw[key] ?? "").trim();
  const errors: Partial<Record<keyof AddressInput, AddressErrorKey>> = {};

  for (const key of ["name", "line1", "city"] as const) if (!value(key)) errors[key] = "required";
  const phone = normalizePhone(value("phone"));
  if (!value("phone")) errors.phone = "required";
  else if (!phone) errors.phone = "phone";
  const postalCode = normalizePostalCode(value("postalCode"));
  if (!postalCode) errors.postalCode = value("postalCode") ? "postalCode" : "required";
  const province = value("province").toUpperCase() as Province;
  if (!PROVINCES.includes(province)) errors.province = "province";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name: value("name").slice(0, 120),
      phone: phone!,
      line1: value("line1").slice(0, 200),
      line2: value("line2").slice(0, 200),
      city: value("city").slice(0, 100),
      province,
      postalCode: postalCode!,
      isDefault: raw.isDefault === "on",
    },
  };
}
