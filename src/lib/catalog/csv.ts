import Papa from "papaparse";

import type { CategoryDefinition } from "@/lib/specs/types";

import {
  BASE_COLUMNS,
  parseProductInput,
  SPEC_PREFIX,
  type ProductInput,
  type RawProductInput,
} from "./product-input";

// CSV columns match the admin form's field names exactly (see
// product-input.ts). Multi-value spec cells use "|" between values.

export function csvColumns(definition: CategoryDefinition): string[] {
  return [...BASE_COLUMNS, ...definition.fields.map((f) => SPEC_PREFIX + f.key)];
}

// Excel needs a byte-order mark to open UTF-8 files with accents correctly.
const BOM = "\uFEFF";

export function toCsv(columns: string[], rows: RawProductInput[]): string {
  const data = rows.map((row) =>
    columns.map((column) => {
      const value = row[column];
      return Array.isArray(value) ? value.join("|") : (value ?? "");
    }),
  );
  return BOM + Papa.unparse({ fields: columns, data }, { newline: "\r\n" });
}

export type CsvRow = { line: number; raw: RawProductInput };

export type CsvParseResult = { ok: true; rows: CsvRow[] } | { ok: false; error: string };

export function parseCsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    // Spreadsheet apps in French locales often save with ";" — let Papa detect it.
    delimitersToGuess: [",", ";", "\t"],
    transformHeader: (header) => header.trim(),
  });
  const fatal = result.errors.find((e) => e.type === "Delimiter" || e.type === "Quotes");
  if (fatal) return { ok: false, error: `Couldn't read the file: ${fatal.message}` };
  if (!result.meta.fields?.includes("sku")) {
    return { ok: false, error: 'The first row must be the column headers, including "sku".' };
  }
  return {
    ok: true,
    // Line 1 is the header, so data starts on line 2.
    rows: result.data.map((raw, i) => ({ line: i + 2, raw })),
  };
}

export type RowReport =
  | { line: number; sku: string; ok: true; input: ProductInput }
  | { line: number; sku: string; ok: false; errors: Record<string, string> };

export function validateRows(rows: CsvRow[]): RowReport[] {
  const seen = new Map<string, number>();
  return rows.map(({ line, raw }) => {
    const parsed = parseProductInput(raw);
    const sku = parsed.ok
      ? parsed.input.sku
      : String(raw.sku ?? "")
          .trim()
          .toUpperCase();
    const errors = parsed.ok ? {} : { ...parsed.errors };
    const firstLine = seen.get(sku);
    if (sku && firstLine !== undefined) errors.sku = `Duplicate SKU (also on line ${firstLine})`;
    if (sku && firstLine === undefined) seen.set(sku, line);
    return Object.keys(errors).length || !parsed.ok
      ? { line, sku, ok: false, errors }
      : { line, sku, ok: true, input: parsed.input };
  });
}
