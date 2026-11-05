import { LocationField } from "@/components/admin/location-options";
import { Field, Input } from "@/components/ui/field";
import type { LocalizedText } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { LOCATION_NAMES, SINGLE_STORE } from "@/lib/store-config";
import { listPurchases } from "@/server/admin/purchases";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";

import { SettingsForm } from "../settings/settings-forms";

import { setCostAction } from "./actions";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "Purchases" };
export const instant = false;

const money = (cents: number) => formatMoney(Math.round(cents), "en");

export default async function PurchasesPage() {
  await requireAdmin();
  const [purchases, skus] = await Promise.all([
    listPurchases(),
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { sku: "asc" },
      select: { sku: true },
    }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(
    new Date(),
  );
  const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Purchases</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Record stock bought from suppliers. Each store keeps its own average cost per product: a
          purchase adds the units and folds their landed cost (unit cost plus a share of shipping,
          duties and fees) into that store&apos;s average.
        </p>
      </div>

      <datalist id="skus">
        {skus.map((p) => (
          <option key={p.sku} value={p.sku} />
        ))}
      </datalist>

      <section aria-label="Receive stock" className="rounded-lg border bg-surface/60 p-5">
        <h2 className="mb-4 font-semibold">Receive stock</h2>
        <PurchaseForm today={today} />
      </section>

      <section aria-label="Set average cost" className="rounded-lg border bg-surface/60 p-5">
        <h2 className="mb-1 font-semibold">Set average cost</h2>
        <p className="mb-4 text-sm text-muted">
          For stock you had before recording purchases, or to fix a mistake. It replaces the
          store&apos;s average for that product.
        </p>
        <SettingsForm action={setCostAction} label="Set cost" keepValues>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="SKU" htmlFor="cost-sku">
              <Input id="cost-sku" name="sku" list="skus" required />
            </Field>
            <LocationField id="cost-location" />
            <Field label="Cost per unit" htmlFor="cost-cost">
              <Input id="cost-cost" name="cost" inputMode="decimal" placeholder="0.00" required />
            </Field>
            <Field label="Note (optional)" htmlFor="cost-note">
              <Input id="cost-note" name="note" />
            </Field>
          </div>
        </SettingsForm>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Recent purchases</h2>
        {purchases.length === 0 && <p className="text-muted">No purchases recorded yet.</p>}
        <ul className="flex flex-col gap-3">
          {purchases.map((p) => {
            const fees = p.shippingCents + p.dutiesCents + p.otherCents;
            const total = p.lines.reduce((s, l) => s + l.quantity * l.unitCostCents, 0) + fees;
            return (
              <li key={p.id} className="rounded-lg border bg-surface/60 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-b px-4 py-2">
                  <span className="font-semibold">PO-{p.number}</span>
                  <span>{date.format(p.purchasedAt)}</span>
                  <span>{p.supplier}</span>
                  {p.reference && <span className="text-muted">#{p.reference}</span>}
                  {!SINGLE_STORE && <span>{LOCATION_NAMES[p.location.code]}</span>}
                  <span className="ml-auto font-semibold tabular-nums">{money(total)}</span>
                </div>
                <table className="w-full">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-1 font-medium">Product</th>
                      <th className="px-4 py-1 text-right font-medium">Units</th>
                      <th className="px-4 py-1 text-right font-medium">Unit cost</th>
                      <th className="px-4 py-1 text-right font-medium">Landed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-1">
                          {l.product.brand.name} {(l.product.name as LocalizedText).en}
                          <span className="ml-2 font-mono text-xs text-muted">{l.product.sku}</span>
                        </td>
                        <td className="px-4 py-1 text-right tabular-nums">{l.quantity}</td>
                        <td className="px-4 py-1 text-right tabular-nums">
                          {money(l.unitCostCents)}
                        </td>
                        <td className="px-4 py-1 text-right tabular-nums">
                          {money(l.landedUnitCostCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(fees > 0 || p.note) && (
                  <p className="border-t px-4 py-2 text-xs text-muted">
                    {fees > 0 &&
                      `Shipping ${money(p.shippingCents)} · duties ${money(p.dutiesCents)} · other ${money(p.otherCents)}, spread by ${p.split === "VALUE" ? "value" : "units"}`}
                    {fees > 0 && p.note && " · "}
                    {p.note}
                    {p.actor && ` · ${p.actor.email}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
