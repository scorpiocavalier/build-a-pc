import { describe, expect, it } from "vitest";

import { parseProductInput, productToRaw, type RawProductInput } from "./product-input";

const valid: RawProductInput = {
  sku: "cpu-9800x3d",
  category: "CPU",
  brand: "AMD",
  name_en: "AMD Ryzen 7 9800X3D",
  name_fr: "",
  description_en: "8-core gaming processor.",
  price: "649.99",
  status: "active",
  stock_TOR: "4",
  stock_MTL: "",
  "spec.socket": "AM5",
  "spec.cores": "8",
  "spec.threads": "16",
  "spec.tdpW": "120",
  "spec.integratedGraphics": "yes",
  "spec.memoryTypes": ["DDR5"],
  "spec.includesCooler": "no",
};

describe("parseProductInput", () => {
  it("normalises a valid row", () => {
    const result = parseProductInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      sku: "CPU-9800X3D",
      categorySlug: "cpu",
      priceCents: 64999,
      compareAtCents: null,
      status: "ACTIVE",
      name: { en: "AMD Ryzen 7 9800X3D", fr: "" },
      specs: { socket: "AM5", cores: 8, memoryTypes: ["DDR5"], includesCooler: false },
      // A blank stock cell leaves that location unchanged.
      stock: { TOR: 4 },
    });
  });

  it("defaults to draft", () => {
    const result = parseProductInput({ ...valid, status: "" });
    expect(result.ok && result.input.status).toBe("DRAFT");
  });

  it("collects errors from base fields and specs together", () => {
    const result = parseProductInput({
      ...valid,
      sku: "bad sku!",
      category: "cpu",
      name_en: "",
      price: "cheap",
      compare_at_price: "10",
      stock_MTL: "-1",
      "spec.socket": "",
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        sku: "SKU may only contain letters, numbers, dots, dashes and underscores",
        name_en: "English name is required",
        price: "Price must be an amount like 549.99",
        stock_MTL: "MTL stock must be a whole number of 0 or more",
        "spec.socket": "Socket is required",
      },
    });
  });

  it("rejects a compare-at price that isn't higher than the price", () => {
    const result = parseProductInput({ ...valid, compare_at_price: "600" });
    expect(!result.ok && result.errors.compare_at_price).toBe(
      "Compare-at price must be higher than the price",
    );
  });

  it("rejects unknown categories without checking specs", () => {
    const result = parseProductInput({ ...valid, category: "toaster" });
    expect(!result.ok && result.errors).toEqual({ category: 'Unknown category "toaster"' });
  });
});

describe("productToRaw", () => {
  it("round-trips through parseProductInput", () => {
    const first = parseProductInput({ ...valid, stock_MTL: "0", compare_at_price: "699" });
    if (!first.ok) throw new Error("expected valid");
    const raw = productToRaw({
      ...first.input,
      stock: { TOR: first.input.stock.TOR ?? 0, MTL: first.input.stock.MTL ?? 0 },
    });
    expect(parseProductInput(raw)).toEqual(first);
  });
});
