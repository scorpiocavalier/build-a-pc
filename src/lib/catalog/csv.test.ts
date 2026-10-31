import { describe, expect, it } from "vitest";

import { getCategoryDefinition } from "@/lib/specs/definitions";

import { csvColumns, parseCsv, toCsv, validateRows } from "./csv";

const memory = getCategoryDefinition("memory")!;

const row = {
  sku: "RAM-1",
  category: "memory",
  brand: "Corsair",
  name_en: "Vengeance 32 GB",
  name_fr: "Vengeance 32 Go — blanc",
  price: "129.99",
  status: "ACTIVE",
  stock_TOR: "3",
  "spec.type": "DDR5",
  "spec.modules": "2",
  "spec.capacityPerModuleGb": "16",
  "spec.speedMts": "6000",
};

describe("CSV round trip", () => {
  it("exports with a BOM and reads back the same values, accents included", () => {
    const csv = toCsv(csvColumns(memory), [row]);
    expect(csv.startsWith("\uFEFFsku,category,brand")).toBe(true);

    const parsed = parseCsv(csv);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].line).toBe(2);
    expect(parsed.rows[0].raw).toMatchObject(row);
  });

  it("reads semicolon-separated files from French spreadsheet apps", () => {
    const parsed = parseCsv("sku;category;price\nRAM-1;memory;129,99\n");
    expect(parsed.ok && parsed.rows[0].raw).toEqual({
      sku: "RAM-1",
      category: "memory",
      price: "129,99",
    });
  });

  it("rejects files without a header row", () => {
    expect(parseCsv("RAM-1,memory,129.99\n")).toEqual({
      ok: false,
      error: 'The first row must be the column headers, including "sku".',
    });
  });
});

describe("validateRows", () => {
  it("reports errors with spreadsheet line numbers and flags duplicate SKUs", () => {
    const parsed = parseCsv(
      toCsv(csvColumns(memory), [row, { ...row, price: "free" }, { ...row, sku: "ram-1" }]),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const report = validateRows(parsed.rows);

    expect(report.map((r) => [r.line, r.ok])).toEqual([
      [2, true],
      [3, false],
      [4, false],
    ]);
    expect(!report[1].ok && report[1].errors).toMatchObject({
      price: "Price must be an amount like 549.99",
      sku: "Duplicate SKU (also on line 2)",
    });
    expect(!report[2].ok && report[2].errors).toEqual({ sku: "Duplicate SKU (also on line 2)" });
  });
});
