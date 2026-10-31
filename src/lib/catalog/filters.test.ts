import { describe, expect, it } from "vitest";

import { getCategoryDefinition } from "@/lib/specs/definitions";

import {
  applyFilters,
  buildFacets,
  parseFilters,
  toggleHref,
  type FilterableProduct,
} from "./filters";

const cpu = getCategoryDefinition("cpu")!;

const product = (
  brand: string,
  name: string,
  priceCents: number,
  socket: string,
  cores: number,
  available = { TOR: 1, MTL: 1 },
): FilterableProduct => ({
  brand,
  name: { en: name },
  priceCents,
  specs: { socket, cores, integratedGraphics: true },
  available,
});

const products = [
  product("AMD", "Ryzen 7", 64999, "AM5", 8),
  product("AMD", "Ryzen 5", 31999, "AM5", 6, { TOR: 0, MTL: 3 }),
  product("Intel", "Core Ultra 7", 45999, "LGA1851", 20, { TOR: 2, MTL: 0 }),
];

describe("parseFilters", () => {
  it("keeps only filterable keys, known locations and sorts", () => {
    expect(
      parseFilters(cpu, {
        socket: ["AM5", "AM5", ""],
        brand: "AMD",
        threads: "16", // not a filter
        available: ["TOR", "NYC"],
        sort: "cheapest",
      }),
    ).toEqual({
      values: { socket: ["AM5"], brand: ["AMD"] },
      availableAt: ["TOR"],
      sort: "price-asc",
    });
  });
});

describe("applyFilters", () => {
  it("ORs values within a filter and ANDs across filters", () => {
    const filters = parseFilters(cpu, { socket: ["AM5", "LGA1851"], brand: "Intel" });
    expect(applyFilters(products, filters).map((p) => p.name.en)).toEqual(["Core Ultra 7"]);
  });

  it("filters by stock at a location", () => {
    const filters = parseFilters(cpu, { available: "TOR" });
    expect(applyFilters(products, filters).map((p) => p.name.en)).toEqual([
      "Core Ultra 7",
      "Ryzen 7",
    ]);
  });

  it("sorts by price descending", () => {
    const filters = parseFilters(cpu, { sort: "price-desc" });
    expect(applyFilters(products, filters).map((p) => p.priceCents)).toEqual([64999, 45999, 31999]);
  });
});

describe("buildFacets", () => {
  it("counts each option against the other active filters", () => {
    const facets = buildFacets(cpu, products, parseFilters(cpu, { socket: "AM5" }));
    const socket = facets.find((f) => f.key === "socket")!;
    const brand = facets.find((f) => f.key === "brand")!;

    // Socket ignores its own selection, so LGA1851 still shows 1.
    expect(socket.options).toEqual([
      { value: "AM5", count: 2, selected: true },
      { value: "LGA1851", count: 1, selected: false },
    ]);
    // Brand respects the socket filter: no Intel AM5 parts.
    expect(brand.options).toEqual([
      { value: "AMD", count: 2, selected: false },
      { value: "Intel", count: 0, selected: false },
    ]);
  });

  it("sorts numeric options numerically and hides single-choice filters", () => {
    const facets = buildFacets(cpu, products, parseFilters(cpu, {}));
    expect(facets.find((f) => f.key === "cores")!.options.map((o) => o.value)).toEqual([
      "6",
      "8",
      "20",
    ]);
    // Every product has integrated graphics, so that filter is useless.
    expect(facets.find((f) => f.key === "integratedGraphics")).toBeUndefined();
  });
});

describe("toggleHref", () => {
  it("adds and removes a value while keeping other params", () => {
    expect(toggleHref({ socket: "AM5", sort: "name" }, "socket", "AM4")).toBe(
      "?sort=name&socket=AM5&socket=AM4",
    );
    expect(toggleHref({ socket: ["AM5", "AM4"] }, "socket", "AM5")).toBe("?socket=AM4");
    expect(toggleHref({ socket: "AM5" }, "socket", "AM5")).toBe("");
  });
});
