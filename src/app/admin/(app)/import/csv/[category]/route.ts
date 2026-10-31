import { csvColumns, toCsv } from "@/lib/catalog/csv";
import { productToRaw } from "@/lib/catalog/product-input";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { listProductsForExport } from "@/server/admin/products";
import { requireAdmin } from "@/server/require-admin";

// GET /admin/import/csv/<category>            → empty template (headers only)
// GET /admin/import/csv/<category>?export=1   → every product in the category
export async function GET(request: Request, ctx: RouteContext<"/admin/import/csv/[category]">) {
  await requireAdmin();
  const { category } = await ctx.params;
  const definition = getCategoryDefinition(category);
  if (!definition) return new Response("Unknown category", { status: 404 });

  const exporting = new URL(request.url).searchParams.has("export");
  const rows = exporting ? (await listProductsForExport(category)).map(productToRaw) : [];
  const filename = `astral-${category}-${exporting ? "products" : "template"}.csv`;

  return new Response(toCsv(csvColumns(definition), rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
