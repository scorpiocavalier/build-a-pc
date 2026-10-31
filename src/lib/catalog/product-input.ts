import { parseDollars } from "@/lib/money";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { parseSpecs } from "@/lib/specs/parse";
import type { SpecValues } from "@/lib/specs/types";
import type { LocalizedText } from "@/lib/localized";

// Product input arrives as flat string fields, from the admin form or a CSV
// row. Both use the same names, so CSV columns match the form exactly:
//
//   sku, category, brand, name_en, name_fr, description_en, description_fr,
//   price, compare_at_price, status, warranty_months, mpn, upc,
//   stock_TOR, stock_MTL, spec.<key> ...

export const LOCATION_CODES = ["TOR", "MTL"] as const;
export type LocationCode = (typeof LOCATION_CODES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const BASE_COLUMNS = [
  "sku",
  "category",
  "brand",
  "name_en",
  "name_fr",
  "description_en",
  "description_fr",
  "price",
  "compare_at_price",
  "status",
  "warranty_months",
  "mpn",
  "upc",
  ...LOCATION_CODES.map((code) => `stock_${code}`),
] as const;

export const SPEC_PREFIX = "spec.";

export type RawProductInput = Record<string, string | string[] | undefined>;

export type ProductInput = {
  sku: string;
  categorySlug: string;
  brandName: string;
  name: LocalizedText;
  description: LocalizedText;
  priceCents: number;
  compareAtCents: number | null;
  status: ProductStatus;
  warrantyMonths: number | null;
  mpn: string | null;
  upc: string | null;
  specs: SpecValues;
  // Only locations with a value are changed; others keep their stock.
  stock: Partial<Record<LocationCode, number>>;
};

export type ProductInputResult =
  { ok: true; input: ProductInput } | { ok: false; errors: Record<string, string> };

const text = (raw: RawProductInput, key: string) => {
  const value = raw[key];
  return (Array.isArray(value) ? value.join("|") : (value ?? "")).trim();
};

export function parseProductInput(raw: RawProductInput): ProductInputResult {
  const errors: Record<string, string> = {};
  const value = (key: string) => text(raw, key);

  const sku = value("sku").toUpperCase();
  if (!sku) errors.sku = "SKU is required";
  else if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(sku)) {
    errors.sku = "SKU may only contain letters, numbers, dots, dashes and underscores";
  }

  const categorySlug = value("category").toLowerCase();
  const definition = getCategoryDefinition(categorySlug);
  if (!categorySlug) errors.category = "Category is required";
  else if (!definition) errors.category = `Unknown category "${categorySlug}"`;

  const brandName = value("brand");
  if (!brandName) errors.brand = "Brand is required";

  const name = { en: value("name_en"), fr: value("name_fr") };
  if (!name.en) errors.name_en = "English name is required";
  const description = { en: value("description_en"), fr: value("description_fr") };

  const priceCents = parseDollars(value("price"));
  if (priceCents === null) errors.price = "Price must be an amount like 549.99";

  let compareAtCents: number | null = null;
  if (value("compare_at_price")) {
    compareAtCents = parseDollars(value("compare_at_price"));
    if (compareAtCents === null) errors.compare_at_price = "Compare-at price must be an amount";
    else if (priceCents !== null && compareAtCents <= priceCents) {
      errors.compare_at_price = "Compare-at price must be higher than the price";
    }
  }

  const status = (value("status").toUpperCase() || "DRAFT") as ProductStatus;
  if (!PRODUCT_STATUSES.includes(status)) {
    errors.status = `Status must be one of: ${PRODUCT_STATUSES.join(", ")}`;
  }

  const wholeNumber = (key: string, label: string) => {
    const s = value(key);
    if (!s) return null;
    if (!/^\d+$/.test(s)) {
      errors[key] = `${label} must be a whole number of 0 or more`;
      return null;
    }
    return Number(s);
  };

  const warrantyMonths = wholeNumber("warranty_months", "Warranty months");
  const stock: ProductInput["stock"] = {};
  for (const code of LOCATION_CODES) {
    const n = wholeNumber(`stock_${code}`, `${code} stock`);
    if (n !== null) stock[code] = n;
  }

  let specs: SpecValues = {};
  if (definition) {
    const specInput: Record<string, unknown> = {};
    for (const field of definition.fields) specInput[field.key] = raw[SPEC_PREFIX + field.key];
    const parsed = parseSpecs(definition, specInput);
    if (parsed.ok) specs = parsed.values;
    else
      for (const [key, message] of Object.entries(parsed.errors))
        errors[SPEC_PREFIX + key] = message;
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    input: {
      sku,
      categorySlug,
      brandName,
      name,
      description,
      priceCents: priceCents!,
      compareAtCents,
      status,
      warrantyMonths,
      mpn: value("mpn") || null,
      upc: value("upc") || null,
      specs,
      stock,
    },
  };
}

// The reverse of parseProductInput: turns a saved product back into the flat
// fields the admin form and CSV export use.
export function productToRaw(product: {
  sku: string;
  categorySlug: string;
  brandName: string;
  name: LocalizedText;
  description: LocalizedText;
  priceCents: number;
  compareAtCents: number | null;
  status: ProductStatus;
  warrantyMonths: number | null;
  mpn: string | null;
  upc: string | null;
  specs: SpecValues;
  stock: Record<LocationCode, number>;
}): RawProductInput {
  const raw: RawProductInput = {
    sku: product.sku,
    category: product.categorySlug,
    brand: product.brandName,
    name_en: product.name.en,
    name_fr: product.name.fr,
    description_en: product.description.en,
    description_fr: product.description.fr,
    price: (product.priceCents / 100).toFixed(2),
    compare_at_price:
      product.compareAtCents === null ? "" : (product.compareAtCents / 100).toFixed(2),
    status: product.status,
    warranty_months: product.warrantyMonths?.toString() ?? "",
    mpn: product.mpn ?? "",
    upc: product.upc ?? "",
  };
  for (const code of LOCATION_CODES) raw[`stock_${code}`] = String(product.stock[code]);
  for (const [key, value] of Object.entries(product.specs)) {
    raw[SPEC_PREFIX + key] = Array.isArray(value)
      ? value
      : typeof value === "boolean"
        ? value
          ? "yes"
          : "no"
        : String(value);
  }
  return raw;
}
