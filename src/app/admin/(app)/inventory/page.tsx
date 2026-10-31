import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { LocalizedText } from "@/lib/localized";
import { cn } from "@/lib/utils";
import { listInventory, listMovements } from "@/server/admin/inventory";
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
};

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireAdmin();
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const settings = await getSettings();
  const filters = { q: one("q"), low: one("low") === "1" };
  const rows = await listInventory(filters, settings.lowStockThreshold);
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
                  <option value="TOR">Toronto</option>
                  <option value="MTL">Montreal</option>
                </Select>
              </Field>
              <Field label="To" htmlFor="transfer-to">
                <Select id="transfer-to" name="to" defaultValue="MTL">
                  <option value="TOR">Toronto</option>
                  <option value="MTL">Montreal</option>
                </Select>
              </Field>
              <Field label="Note (optional)" htmlFor="transfer-note" className="sm:col-span-2">
                <Input id="transfer-note" name="note" placeholder="e.g. for order ATG-10042" />
              </Field>
            </div>
          </SettingsForm>
        </section>

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
              <Field label="Location" htmlFor="adjust-location">
                <Select id="adjust-location" name="location" defaultValue="TOR">
                  <option value="TOR">Toronto</option>
                  <option value="MTL">Montreal</option>
                </Select>
              </Field>
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
        <form className="flex flex-wrap items-end gap-2" role="search">
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="SKU, name or brand"
            aria-label="Search stock"
            className="w-64"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={filters.low}
              className="size-4 accent-[var(--accent)]"
            />
            Low stock only ({settings.lowStockThreshold} or fewer free)
          </label>
          <Button variant="outline">Filter</Button>
        </form>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Toronto free</th>
                <th className="px-3 py-2 text-right font-medium">on hand / reserved</th>
                <th className="px-3 py-2 text-right font-medium">Montreal free</th>
                <th className="px-3 py-2 text-right font-medium">on hand / reserved</th>
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
                  {(["TOR", "MTL"] as const).map((code) => {
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
