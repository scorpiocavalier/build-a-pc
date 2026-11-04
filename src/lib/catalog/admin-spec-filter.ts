import { buildFacets, parseFilters, type Facet } from "@/lib/catalog/filters";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import type { SpecValues } from "@/lib/specs/types";

// Spec dropdowns for admin lists (inventory, products): once a part is
// picked, the same spec filters as the storefront's category page, one
// value per spec. URL keys are prefixed, e.g. "spec.socket=AM5".

type SearchParams = Record<string, string | string[] | undefined>;

export function specParams(params: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (key.startsWith("spec.") && v) out[key.slice(5)] = v;
  }
  return out;
}

type Row = { specs: unknown; priceCents: number };

export function filterBySpecs<T extends Row>(
  category: string | undefined,
  rows: T[],
  specs: Record<string, string>,
): { rows: T[]; facets: Facet[] } {
  const definition = category ? getCategoryDefinition(category) : undefined;
  if (!definition) return { rows, facets: [] };
  // Brand has its own dropdown, so it's left out here.
  const active = parseFilters(definition, { ...specs, brand: undefined });
  const products = rows.map((row) => ({
    row,
    // Brand and name only matter for the storefront's brand facet and sorting.
    brand: "",
    name: { en: "" },
    priceCents: row.priceCents,
    specs: (row.specs ?? {}) as SpecValues,
    // Availability isn't filtered here; the lists have their own stock filters.
    available: { TOR: 0, MTL: 0 },
  }));
  const facets = buildFacets(definition, products, active).filter((f) => f.key !== "brand");
  const kept = products.filter((p) =>
    Object.entries(active.values).every(([key, selected]) => {
      const v = p.specs[key];
      const values = v === undefined ? [] : Array.isArray(v) ? v : [String(v)];
      return selected.some((s) => values.includes(s));
    }),
  );
  return { rows: kept.map((p) => p.row), facets };
}
