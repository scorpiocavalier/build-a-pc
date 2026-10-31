"use server";

import { updateTag } from "next/cache";

import { parseCsv, validateRows } from "@/lib/catalog/csv";
import { saveProduct } from "@/server/catalog/save-product";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";

export type ImportRowResult = {
  line: number;
  sku: string;
  action: "create" | "update" | null;
  errors: Record<string, string>;
};

export type ImportState = {
  mode?: "preview" | "applied";
  fileName?: string;
  error?: string;
  rows?: ImportRowResult[];
};

const MAX_CSV_BYTES = 3 * 1024 * 1024;

export async function importCsvAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireAdmin();
  const file = formData.get("file");
  const apply = formData.get("mode") === "apply";
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > MAX_CSV_BYTES) return { error: "That file is larger than 3 MB. Split it up." };

  const parsed = parseCsv(await file.text());
  if (!parsed.ok) return { error: parsed.error, fileName: file.name };
  if (parsed.rows.length === 0)
    return { error: "The file has no product rows.", fileName: file.name };

  const report = validateRows(parsed.rows);
  const existing = new Set(
    (
      await db.product.findMany({
        where: { sku: { in: report.map((r) => r.sku).filter(Boolean) } },
        select: { sku: true },
      })
    ).map((p) => p.sku),
  );
  const rows: ImportRowResult[] = report.map((r) => ({
    line: r.line,
    sku: r.sku,
    action: r.ok ? (existing.has(r.sku) ? "update" : "create") : null,
    errors: r.ok ? {} : r.errors,
  }));

  const hasErrors = report.some((r) => !r.ok);
  if (!apply || hasErrors) return { mode: "preview", fileName: file.name, rows };

  // All or nothing: a half-imported catalog is harder to fix than a rejected file.
  await db.$transaction(
    async (tx) => {
      for (const r of report) {
        if (r.ok) await saveProduct(tx, r.input, { actorId: user.id, stockReason: "IMPORT" });
      }
    },
    { timeout: 120_000 },
  );
  updateTag(CATALOG_TAG);
  return { mode: "applied", fileName: file.name, rows };
}
