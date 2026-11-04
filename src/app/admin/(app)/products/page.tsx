import { ImageOff, Plus } from "lucide-react";
import Link from "next/link";

import { FilterForm } from "@/components/admin/filter-form";
import { SpecSelects } from "@/components/admin/spec-selects";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { specParams } from "@/lib/catalog/admin-spec-filter";
import { PRODUCT_STATUSES } from "@/lib/catalog/product-input";
import { formatMoney } from "@/lib/money";
import { CATEGORIES } from "@/lib/specs/definitions";
import { cn } from "@/lib/utils";
import { listAdminProducts, listBrands } from "@/server/admin/products";

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
    brand: one("brand"),
    missing: one("missing"),
    stock: one("stock"),
    specs: specParams(params),
  };
  const [{ products, specFacets }, brands] = await Promise.all([
    listAdminProducts(filters),
    listBrands(),
  ]);
  const filtered =
    Object.entries(filters).some(([key, value]) => key !== "specs" && value) ||
    Object.keys(filters.specs).length > 0;

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

      <section className="flex flex-col gap-3">
        <FilterForm action="/admin/products">
          <Input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Search name, SKU, brand…"
            aria-label="Search products"
            className="w-64"
          />
          <Select
            name="category"
            defaultValue={filters.category}
            aria-label="Part"
            className="w-44"
          >
            <option value="">All parts</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name.en}
              </option>
            ))}
          </Select>
          <Select name="brand" defaultValue={filters.brand} aria-label="Brand" className="w-40">
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={filters.status} aria-label="Status" className="w-36">
            <option value="">Any status</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          <Select
            name="missing"
            defaultValue={filters.missing}
            aria-label="Content"
            className="w-44"
          >
            <option value="">Any content</option>
            <option value="fr">Missing French</option>
            <option value="photos">No photos</option>
          </Select>
          <Select name="stock" defaultValue={filters.stock} aria-label="Stock" className="w-52">
            <option value="">Any stock</option>
            <option value="out">Out of stock at both stores</option>
          </Select>
          <SpecSelects facets={specFacets} />
          {filtered && (
            <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
              Clear filters
            </Link>
          )}
        </FilterForm>
        <p role="status" className="text-sm text-muted">
          {products.length} {products.length === 1 ? "product" : "products"}
          {products.length === 500 && " (first 500; narrow the filters to see more)"}
          {!filters.category && " · pick a part to filter by its specs"}
        </p>
      </section>

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
