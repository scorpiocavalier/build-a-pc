import { Field, Input } from "@/components/ui/field";
import type { LocalizedText } from "@/lib/localized";
import { DEFAULT_LOCATION } from "@/lib/store-config";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";
import { getSettings, stripeEnabled } from "@/server/settings";

import { saveStoreLocation, saveStoreSettings, saveTaxRate } from "./actions";
import { SettingsForm } from "./settings-forms";

export const metadata = { title: "Settings" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const dollars = (cents: number) => (cents / 100).toFixed(2);
const percent = (thousandths: number) => String(thousandths / 1000);

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, store, taxRates] = await Promise.all([
    getSettings(),
    db.location.findUniqueOrThrow({ where: { code: DEFAULT_LOCATION } }),
    db.taxRate.findMany({ orderBy: { province: "asc" } }),
  ]);
  const address = store.address as LocalizedText;
  const hours = store.hours as LocalizedText;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted">
          Card payments:{" "}
          {stripeEnabled() ? "on (Stripe is configured)" : "off until the Stripe keys are set"}.
        </p>
      </div>

      <Section title="Payments and holds">
        <SettingsForm action={saveStoreSettings}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="e-Transfer email"
              htmlFor="etransferEmail"
              hint="Where customers send e-Transfers."
            >
              <Input
                id="etransferEmail"
                name="etransferEmail"
                type="email"
                defaultValue={settings.etransferEmail}
              />
            </Field>
            <Field
              label="Cash only for totals under ($)"
              htmlFor="cashMax"
              hint="Keep at or below 10,000."
            >
              <Input
                id="cashMax"
                name="cashMax"
                defaultValue={dollars(settings.cashMaxCents)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label="Deposit for assembled PCs (%)"
              htmlFor="depositPercent"
              hint="Needed before assembly starts."
            >
              <Input
                id="depositPercent"
                name="depositPercent"
                defaultValue={settings.depositPercent}
                inputMode="numeric"
              />
            </Field>
            <Field label="Assembly time shown to customers (business days)" htmlFor="assemblyDays">
              <Input
                id="assemblyDays"
                name="assemblyDays"
                defaultValue={settings.assemblyDays}
                inputMode="numeric"
              />
            </Field>
            <Field
              label="Card: hold stock for (minutes)"
              htmlFor="cardHoldMinutes"
              hint="30 to 1440."
            >
              <Input
                id="cardHoldMinutes"
                name="cardHoldMinutes"
                defaultValue={settings.cardHoldMinutes}
                inputMode="numeric"
              />
            </Field>
            <Field label="e-Transfer: hold stock for (hours)" htmlFor="etransferHoldHours">
              <Input
                id="etransferHoldHours"
                name="etransferHoldHours"
                defaultValue={settings.etransferHoldHours}
                inputMode="numeric"
              />
            </Field>
            <Field label="Cash: hold unconfirmed orders for (days)" htmlFor="cashHoldDays">
              <Input
                id="cashHoldDays"
                name="cashHoldDays"
                defaultValue={settings.cashHoldDays}
                inputMode="numeric"
              />
            </Field>
            <Field
              label="GST/HST registration number"
              htmlFor="gstNumber"
              hint="Shown on emails once set."
            >
              <Input id="gstNumber" name="gstNumber" defaultValue={settings.gstNumber} />
            </Field>
            <Field label="QST registration number" htmlFor="qstNumber">
              <Input id="qstNumber" name="qstNumber" defaultValue={settings.qstNumber} />
            </Field>
            <Field
              label="Restocking fee (%)"
              htmlFor="restockingPercent"
              hint="On returns that aren't defective, wrong or misdescribed."
            >
              <Input
                id="restockingPercent"
                name="restockingPercent"
                defaultValue={settings.restockingPercent}
                inputMode="numeric"
              />
            </Field>
            <Field label="Return window (days after handover)" htmlFor="returnWindowDays">
              <Input
                id="returnWindowDays"
                name="returnWindowDays"
                defaultValue={settings.returnWindowDays}
                inputMode="numeric"
              />
            </Field>
            <Field
              label="Customer contact email"
              htmlFor="contactEmail"
              hint="Shown in the footer and legal pages."
            >
              <Input id="contactEmail" name="contactEmail" defaultValue={settings.contactEmail} />
            </Field>
            <Field
              label="Person responsible for privacy"
              htmlFor="privacyOfficer"
              hint="Name and title, e.g. Jane Doe, Owner (required by Quebec Law 25)."
            >
              <Input
                id="privacyOfficer"
                name="privacyOfficer"
                defaultValue={settings.privacyOfficer}
              />
            </Field>
            <Field
              label="Low stock at (units)"
              htmlFor="lowStockThreshold"
              hint="Shown on the dashboard and inventory page."
            >
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                defaultValue={settings.lowStockThreshold}
                inputMode="numeric"
              />
            </Field>
            <Field
              label="Target margin (%)"
              htmlFor="targetMarginPercent"
              hint="Inventory flags products whose margin falls below this."
            >
              <Input
                id="targetMarginPercent"
                name="targetMarginPercent"
                defaultValue={settings.targetMarginPercent}
                inputMode="numeric"
              />
            </Field>
            <Field
              label="Cost change alert (%)"
              htmlFor="costDriftPercent"
              hint="Flags products whose last purchase cost is this far from the average."
            >
              <Input
                id="costDriftPercent"
                name="costDriftPercent"
                defaultValue={settings.costDriftPercent}
                inputMode="numeric"
              />
            </Field>
          </div>
        </SettingsForm>
      </Section>

      {/* Used by checkout and order emails; not shown on the public site. */}
      <Section title="Store">
        <SettingsForm action={saveStoreLocation}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pickup address (English)" htmlFor="store-address_en">
              <Input id="store-address_en" name="address_en" defaultValue={address.en} />
            </Field>
            <Field label="Pickup address (French)" htmlFor="store-address_fr">
              <Input id="store-address_fr" name="address_fr" defaultValue={address.fr} lang="fr" />
            </Field>
            <Field label="Hours (English)" htmlFor="store-hours_en">
              <Input id="store-hours_en" name="hours_en" defaultValue={hours.en} />
            </Field>
            <Field label="Hours (French)" htmlFor="store-hours_fr">
              <Input id="store-hours_fr" name="hours_fr" defaultValue={hours.fr} lang="fr" />
            </Field>
            <Field
              label="Delivers to postal codes starting with"
              htmlFor="store-prefixes"
              hint="Comma-separated, e.g. M, L4, L5. Empty means no delivery."
            >
              <Input
                id="store-prefixes"
                name="prefixes"
                defaultValue={store.deliveryPostalPrefixes.join(", ")}
              />
            </Field>
            <Field label="Delivery fee ($)" htmlFor="store-fee" hint="0 for free delivery.">
              <Input
                id="store-fee"
                name="deliveryFee"
                defaultValue={dollars(store.deliveryFeeCents)}
                inputMode="decimal"
              />
            </Field>
          </div>
        </SettingsForm>
      </Section>

      <Section title="Sales tax">
        <p className="-mt-2 mb-4 text-sm text-muted">
          Rates in percent. Turn collection on only once you&apos;re registered in that province;
          until then checkout charges no tax.
        </p>
        <div className="flex flex-col gap-6">
          {taxRates.map((tax) => (
            <SettingsForm
              key={tax.province}
              action={saveTaxRate.bind(null, tax.province)}
              label={`Save ${tax.province}`}
            >
              <div className="grid items-end gap-4 sm:grid-cols-5">
                <label className="flex items-center gap-2 text-sm font-medium sm:pb-2.5">
                  <input
                    type="checkbox"
                    name="collect"
                    defaultChecked={tax.collect}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Collect in {tax.province}
                </label>
                {(["hst", "gst", "pst", "qst"] as const).map((key) => (
                  <Field key={key} label={key.toUpperCase()} htmlFor={`${tax.province}-${key}`}>
                    <Input
                      id={`${tax.province}-${key}`}
                      name={key}
                      defaultValue={percent(tax[key])}
                      inputMode="decimal"
                    />
                  </Field>
                ))}
              </div>
            </SettingsForm>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-surface/60 p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
