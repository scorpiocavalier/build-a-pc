import { ImageOff, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { PRODUCT_STATUSES } from "@/lib/catalog/product-input";
import { formatMoney } from "@/lib/money";
import { CATEGORIES } from "@/lib/specs/definitions";
import { cn } from "@/lib/utils";
import { listAdminProducts } from "@/server/admin/products";

export const metadata = { title: "Products" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const STATUS_STYLE = {
  ACTIVE: "border-emerald-400/40 text-emerald-300",
  DRAFT: "border-amber-400/40 text-amber-300",
  ARCHIVED: "border-border text-muted",
} as const;

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const params = await searchParams;
  const one = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const filters = {
    q: one("q"),
    category: one("category"),
    status: one("status"),
    missing: one("missing"),
    stock: one("stock"),
  };
  const products = await listAdminProducts(filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus aria-hidden="true" className="size-4" />
            New product
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Search name, SKU, brand…"
          aria-label="Search products"
          className="w-64"
        />
        <Select
          name="category"
          defaultValue={filters.category}
          aria-label="Category"
          className="w-48"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name.en}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={filters.status} aria-label="Status" className="w-36">
          <option value="">Any status</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </Select>
        {filters.missing && <input type="hidden" name="missing" value={filters.missing} />}
        {filters.stock && <input type="hidden" name="stock" value={filters.stock} />}
        <Button variant="outline">Filter</Button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/products" className="px-2 text-sm text-accent hover:underline">
            Clear
          </Link>
        )}
      </form>
      {(filters.missing || filters.stock) && (
        <p className="text-sm text-muted">
          Showing only products {filters.missing === "fr" && "with missing French text"}
          {filters.stock === "out" && "that are out of stock at both locations"}.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Toronto</th>
              <th className="px-3 py-2 text-right font-medium">Montreal</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-surface/60">
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-accent">
                    {p.brand} {p.name.en}
                  </Link>
                  <span className="mt-0.5 flex gap-2 text-xs">
                    {p.missingFrench && <span className="text-amber-300">Missing French</span>}
                    {p.imageCount === 0 && (
                      <span className="flex items-center gap-1 text-muted">
                        <ImageOff aria-hidden="true" className="size-3" /> No photos
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-3 py-2 text-muted">{p.category.en}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(p.priceCents, "en")}
                </td>
                <td
                  className={cn("px-3 py-2 text-right tabular-nums", !p.stock.TOR && "text-muted")}
                >
                  {p.stock.TOR}
                </td>
                <td
                  className={cn("px-3 py-2 text-right tabular-nums", !p.stock.MTL && "text-muted")}
                >
                  {p.stock.MTL}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      STATUS_STYLE[p.status],
                    )}
                  >
                    {p.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="p-6 text-center text-muted">No products found.</p>}
      </div>
    </div>
  );
}
