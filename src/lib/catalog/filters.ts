import type { CategoryDefinition, SpecField, SpecValues } from "@/lib/specs/types";
import { LOCATION_CODES, type LocationCode } from "./product-input";

// Category-page filtering, done in memory over a category's cached product
// list. Within one filter values are OR-ed; across filters they are AND-ed.

export type FilterableProduct = {
  brand: string;
  name: { en: string };
  priceCents: number;
  specs: SpecValues;
  available: Record<LocationCode, number>;
};

export const SORTS = ["price-asc", "price-desc", "name"] as const;
export type Sort = (typeof SORTS)[number];

export type ActiveFilters = {
  // Keyed by spec field key, plus "brand".
  values: Record<string, string[]>;
  // Only show products available at these locations.
  availableAt: LocationCode[];
  sort: Sort;
};

export type Facet = {
  key: string;
  field: SpecField | null; // null for brand
  options: { value: string; count: number; selected: boolean }[];
};

type SearchParams = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export function filterKeys(definition: CategoryDefinition): string[] {
  return ["brand", ...definition.fields.filter((f) => f.filter).map((f) => f.key)];
}

export function parseFilters(definition: CategoryDefinition, params: SearchParams): ActiveFilters {
  const values: Record<string, string[]> = {};
  for (const key of filterKeys(definition)) {
    const selected = [...new Set(list(params[key]).filter(Boolean))];
    if (selected.length) values[key] = selected;
  }
  const availableAt = list(params.available).filter((code): code is LocationCode =>
    (LOCATION_CODES as readonly string[]).includes(code),
  );
  const sortParam = list(params.sort)[0];
  const sort = (SORTS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as Sort)
    : "price-asc";
  return { values, availableAt, sort };
}

// String forms of a product's value for a filter, e.g. "AM5", "true", "16".
function valuesFor(product: FilterableProduct, key: string): string[] {
  if (key === "brand") return [product.brand];
  const value = product.specs[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [String(value)];
}

function matches(product: FilterableProduct, filters: ActiveFilters, skipKey?: string): boolean {
  if (
    filters.availableAt.length &&
    !filters.availableAt.some((code) => product.available[code] > 0)
  ) {
    return false;
  }
  for (const [key, selected] of Object.entries(filters.values)) {
    if (key === skipKey) continue;
    const productValues = valuesFor(product, key);
    if (!selected.some((v) => productValues.includes(v))) return false;
  }
  return true;
}

export function applyFilters<P extends FilterableProduct>(
  products: P[],
  filters: ActiveFilters,
): P[] {
  const result = products.filter((p) => matches(p, filters));
  const byName = (a: P, b: P) => `${a.brand} ${a.name.en}`.localeCompare(`${b.brand} ${b.name.en}`);
  switch (filters.sort) {
    case "price-asc":
      return result.sort((a, b) => a.priceCents - b.priceCents || byName(a, b));
    case "price-desc":
      return result.sort((a, b) => b.priceCents - a.priceCents || byName(a, b));
    case "name":
      return result.sort(byName);
  }
}

function optionOrder(field: SpecField | null, values: string[]): string[] {
  if (field && (field.type === "enum" || field.type === "multiEnum")) {
    const order = field.options.map((o) => o.value);
    return values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  if (field && (field.type === "int" || field.type === "decimal")) {
    return values.sort((a, b) => Number(a) - Number(b));
  }
  if (field?.type === "boolean") return values.sort().reverse(); // "true" first
  return values.sort((a, b) => a.localeCompare(b));
}

// Each option's count reflects every other active filter, so customers can
// see what selecting it would add.
export function buildFacets(
  definition: CategoryDefinition,
  products: FilterableProduct[],
  filters: ActiveFilters,
): Facet[] {
  const facets: Facet[] = [];
  for (const key of filterKeys(definition)) {
    const field = key === "brand" ? null : definition.fields.find((f) => f.key === key)!;
    const pool = products.filter((p) => matches(p, filters, key));
    const counts = new Map<string, number>();
    for (const product of products) {
      for (const value of valuesFor(product, key)) if (!counts.has(value)) counts.set(value, 0);
    }
    for (const product of pool) {
      for (const value of valuesFor(product, key)) counts.set(value, counts.get(value)! + 1);
    }
    const selected = filters.values[key] ?? [];
    const options = optionOrder(field, [...counts.keys()]).map((value) => ({
      value,
      count: counts.get(value)!,
      selected: selected.includes(value),
    }));
    // A filter with a single choice doesn't help anyone narrow down.
    if (options.length > 1 || selected.length) facets.push({ key, field, options });
  }
  return facets;
}

// Builds the query string for a link that toggles one filter value.
export function toggleHref(params: SearchParams, key: string, value: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const item of list(v)) next.append(k, item);
  const current = next.getAll(key);
  next.delete(key);
  const updated = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  for (const v of updated) next.append(key, v);
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}
