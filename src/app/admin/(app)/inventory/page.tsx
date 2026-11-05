import Link from "next/link";

import { Field, Input, Select } from "@/components/ui/field";
import type { LocalizedText } from "@/lib/localized";
import { CostCell } from "@/components/admin/cost-cell";
import { LocationField, LocationOptions } from "@/components/admin/location-options";
import { FilterForm } from "@/components/admin/filter-form";
import { SpecSelects } from "@/components/admin/spec-selects";
import { specParams } from "@/lib/catalog/admin-spec-filter";
import { parseCostFilter, parseLocation, parseStockLevel } from "@/lib/inventory/filter";
import { formatMoney } from "@/lib/money";
import { LOCATION_CODES, LOCATION_NAMES, SINGLE_STORE } from "@/lib/store-config";
import { cn } from "@/lib/utils";
import { inventoryFilterOptions, listInventory, listMovements } from "@/server/admin/inventory";
import { requireAdmin } from "@/server/require-admin";
import { getSettings } from "@/server/settings";

import { SettingsForm } from "../settings/settings-forms";

import { adjustAction, transferAction } from "./actions";

export const metadata = { title: "Inventory" };
export const instant = false;

const REASON: Record<string, string> = {
  INITIAL: "initial",
  ADJUSTMENT: "adjustment",
  IMPORT: "CSV import",
  TRANSFER: "transfer",
  SALE: "sale",
  RETURN: "return",
  WRITE_OFF: "write-off",
  PURCHASE: "purchase",
};

const money = (cents: number) => formatMoney(Math.round(cents), "en");

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireAdmin();
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const settings = await getSettings();
  const status = one("status");
  const filters = {
    q: one("q"),
    category: one("category") || undefined,
    brand: one("brand") || undefined,
    status: status === "ACTIVE" || status === "DRAFT" ? (status as "ACTIVE" | "DRAFT") : undefined,
    location: parseLocation(one("location")),
    // "low=1" is the older link format (e.g. from the Today page).
    stock: one("low") === "1" ? ("low" as const) : parseStockLevel(one("stock")),
    cost: parseCostFilter(one("cost")),
    specs: specParams(params),
  };
  const [{ rows, specFacets }, options] = await Promise.all([
    listInventory(filters, settings),
    inventoryFilterOptions(),
  ]);
  const filtered =
    !!filters.q ||
    !!filters.category ||
    !!filters.brand ||
    !!filters.status ||
    filters.location !== "all" ||
    filters.stock !== "all" ||
    filters.cost !== "all" ||
    Object.keys(filters.specs).length > 0;
  // The history narrows to one product when the search is its exact SKU.
  const exactSku = rows.find((r) => r.sku.toLowerCase() === filters.q.trim().toLowerCase())?.sku;
  const movements = await listMovements(exactSku);
  const skus = rows.map((r) => r.sku);
  const date = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Stock per location. &ldquo;Free&rdquo; is on hand minus what open orders have reserved.
          Every change is kept in the history below.
        </p>
      </div>

      <datalist id="skus">
        {skus.map((sku) => (
          <option key={sku} value={sku} />
        ))}
      </datalist>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Moving stock between stores only applies when one site runs both. */}
        {!SINGLE_STORE && (
          <section aria-label="Move stock" className="rounded-lg border bg-surface/60 p-5">
            <h2 className="mb-1 font-semibold">Move stock between locations</h2>
            <p className="mb-4 text-sm text-muted">
              Record it when the units physically leave. Reserved units can&apos;t be moved.
            </p>
            <SettingsForm action={transferAction} label="Move stock" keepValues>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="SKU" htmlFor="transfer-sku">
                  <Input id="transfer-sku" name="sku" list="skus" required />
                </Field>
                <Field label="Units" htmlFor="transfer-quantity">
                  <Input id="transfer-quantity" name="quantity" inputMode="numeric" required />
                </Field>
                <Field label="From" htmlFor="transfer-from">
                  <Select id="transfer-from" name="from" defaultValue="TOR">
                    <LocationOptions />
                  </Select>
                </Field>
                <Field label="To" htmlFor="transfer-to">
                  <Select id="transfer-to" name="to" defaultValue="MTL">
                    <LocationOptions />
                  </Select>
                </Field>
                <Field label="Note (optional)" htmlFor="transfer-note" className="sm:col-span-2">
                  <Input id="transfer-note" name="note" placeholder="e.g. for order ATG-10042" />
                </Field>
              </div>
            </SettingsForm>
          </section>
        )}

        <section aria-label="Adjust stock" className="rounded-lg border bg-surface/60 p-5">
          <h2 className="mb-1 font-semibold">Adjust stock</h2>
          <p className="mb-4 text-sm text-muted">
            For count corrections and damaged units. Use a negative number to remove units.
          </p>
          <SettingsForm action={adjustAction} label="Save adjustment" keepValues>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SKU" htmlFor="adjust-sku">
                <Input id="adjust-sku" name="sku" list="skus" required />
              </Field>
              <Field label="Change" htmlFor="adjust-delta" hint="e.g. 3 or -1">
                <Input id="adjust-delta" name="delta" inputMode="numeric" required />
              </Field>
              <LocationField id="adjust-location" />
              <Field label="Type" htmlFor="adjust-reason">
                <Select id="adjust-reason" name="reason" defaultValue="ADJUSTMENT">
                  <option value="ADJUSTMENT">Count correction</option>
                  <option value="WRITE_OFF">Write-off (damaged, lost)</option>
                </Select>
              </Field>
              <Field label="Reason" htmlFor="adjust-note" className="sm:col-span-2">
                <Input id="adjust-note" name="note" required />
              </Field>
            </div>
          </SettingsForm>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <FilterForm action="/admin/inventory">
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="SKU, name or brand"
            aria-label="Search stock"
            type="search"
            className="w-64"
          />
          <Select
            name="category"
            defaultValue={filters.category ?? ""}
            aria-label="Part"
            className="w-44"
          >
            <option value="">All parts</option>
            {options.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {(c.name as LocalizedText).en}
              </option>
            ))}
          </Select>
          <Select
            name="brand"
            defaultValue={filters.brand ?? ""}
            aria-label="Brand"
            className="w-40"
          >
            <option value="">All brands</option>
            {options.brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            name="status"
            defaultValue={filters.status ?? ""}
            aria-label="Status"
            className="w-36"
          >
            <option value="">Active and drafts</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Drafts</option>
          </Select>
          {!SINGLE_STORE && (
            <Select
              id="filter-location"
              name="location"
              defaultValue={filters.location}
              aria-label="Location"
              className="w-36"
            >
              <option value="all">Both locations</option>
              <LocationOptions />
            </Select>
          )}
          <Select name="stock" defaultValue={filters.stock} aria-label="Stock" className="w-44">
            <option value="all">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low ({settings.lowStockThreshold} or fewer free)</option>
            <option value="out">Out of stock</option>
          </Select>
          <Select name="cost" defaultValue={filters.cost} aria-label="Cost" className="w-52">
            <option value="all">Any cost</option>
            <option value="review">
              Needs a price review (under {settings.targetMarginPercent}% margin or cost moved{" "}
              {settings.costDriftPercent}%+)
            </option>
            <option value="nocost">In stock with no cost</option>
          </Select>
          <SpecSelects facets={specFacets} />
          {filtered && (
            <Link href="/admin/inventory" className="text-sm text-muted hover:text-foreground">
              Clear filters
            </Link>
          )}
        </FilterForm>
        <p role="status" className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "product" : "products"}
          {!filters.category && " · pick a part to filter by its specs"}
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                {LOCATION_CODES.map((code) => [
                  <th key={`${code}-free`} className="px-3 py-2 text-right font-medium">
                    {LOCATION_NAMES[code]} free
                  </th>,
                  <th key={`${code}-detail`} className="px-3 py-2 text-right font-medium">
                    on hand / reserved
                  </th>,
                  <th key={`${code}-cost`} className="px-3 py-2 text-right font-medium">
                    {LOCATION_NAMES[code]} cost · margin
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className={cn(row.low && "bg-amber-400/5")}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/products/${row.id}`} className="hover:text-accent">
                      {row.brand.name} {(row.name as LocalizedText).en}
                    </Link>
                    <span className="block font-mono text-xs text-muted">
                      {row.sku}
                      {row.status === "DRAFT" && " · draft"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(row.priceCents)}</td>
                  {LOCATION_CODES.map((code) => {
                    const s = row.stock[code];
                    const free = s.onHand - s.reserved;
                    return [
                      <td
                        key={`${code}-free`}
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          free <= settings.lowStockThreshold && "text-amber-300",
                          free <= 0 && "text-red-300",
                        )}
                      >
                        {free}
                      </td>,
                      <td
                        key={`${code}-detail`}
                        className="px-3 py-2 text-right text-muted tabular-nums"
                      >
                        {s.onHand} / {s.reserved}
                      </td>,
                      <CostCell
                        key={`${code}-cost`}
                        priceCents={row.priceCents}
                        avgCostCents={s.avgCostCents}
                        lastCostCents={s.lastCostCents}
                        rules={settings}
                      />,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-center text-muted">No products found.</p>}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          Stock history{exactSku ? ` for ${exactSku}` : " (latest 50)"}
        </h2>
        <ul className="flex flex-col divide-y rounded-lg border bg-surface/60 text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex flex-wrap gap-x-3 px-3 py-2">
              <span className="w-36 shrink-0 text-muted">{date.format(m.createdAt)}</span>
              <span
                className={cn(
                  "w-12 text-right font-semibold tabular-nums",
                  m.delta > 0 ? "text-emerald-300" : "text-red-300",
                )}
              >
                {m.delta > 0 ? `+${m.delta}` : m.delta}
              </span>
              <span className="font-mono text-xs leading-5">{m.product.sku}</span>
              <span>{m.location.code}</span>
              <span className="text-muted">
                {REASON[m.reason]}
                {m.unitCostCents !== null ? ` · ${money(m.unitCostCents)} each` : ""}
                {m.note ? ` · ${m.note}` : ""}
                {m.actor ? ` · ${m.actor.email}` : ""}
              </span>
            </li>
          ))}
          {movements.length === 0 && <li className="p-4 text-muted">No stock changes yet.</li>}
        </ul>
      </section>
    </div>
  );
}
