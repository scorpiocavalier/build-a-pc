import { Field, Input } from "@/components/ui/field";
import type { LocalizedText } from "@/lib/localized";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";
import { getSettings, stripeEnabled } from "@/server/settings";

import { saveLocation, saveStoreSettings, saveTaxRate } from "./actions";
import { SettingsForm } from "./settings-forms";

export const metadata = { title: "Settings" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const dollars = (cents: number) => (cents / 100).toFixed(2);
const percent = (thousandths: number) => String(thousandths / 1000);

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, locations, taxRates] = await Promise.all([
    getSettings(),
    db.location.findMany({ orderBy: { code: "desc" } }),
    db.taxRate.findMany({ orderBy: { province: "asc" } }),
  ]);

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
            <Field label="Assembly fee per PC ($)" htmlFor="assemblyFee">
              <Input
                id="assemblyFee"
                name="assemblyFee"
                defaultValue={dollars(settings.assemblyFeeCents)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label="Windows licence included (SKU)"
              htmlFor="windowsSku"
              hint="Added to every assembled PC and taken from stock."
            >
              <Input id="windowsSku" name="windowsSku" defaultValue={settings.windowsSku} />
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
          </div>
        </SettingsForm>
      </Section>

      {locations.map((location) => {
        const address = location.address as LocalizedText;
        const hours = location.hours as LocalizedText;
        return (
          <Section key={location.code} title={`${(location.name as LocalizedText).en} location`}>
            <SettingsForm action={saveLocation.bind(null, location.code)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pickup address (English)" htmlFor={`${location.code}-address_en`}>
                  <Input
                    id={`${location.code}-address_en`}
                    name="address_en"
                    defaultValue={address.en}
                  />
                </Field>
                <Field label="Pickup address (French)" htmlFor={`${location.code}-address_fr`}>
                  <Input
                    id={`${location.code}-address_fr`}
                    name="address_fr"
                    defaultValue={address.fr}
                    lang="fr"
                  />
                </Field>
                <Field label="Hours (English)" htmlFor={`${location.code}-hours_en`}>
                  <Input id={`${location.code}-hours_en`} name="hours_en" defaultValue={hours.en} />
                </Field>
                <Field label="Hours (French)" htmlFor={`${location.code}-hours_fr`}>
                  <Input
                    id={`${location.code}-hours_fr`}
                    name="hours_fr"
                    defaultValue={hours.fr}
                    lang="fr"
                  />
                </Field>
                <Field
                  label="Delivers to postal codes starting with"
                  htmlFor={`${location.code}-prefixes`}
                  hint="Comma-separated, e.g. M, L4, L5. Empty means no delivery."
                >
                  <Input
                    id={`${location.code}-prefixes`}
                    name="prefixes"
                    defaultValue={location.deliveryPostalPrefixes.join(", ")}
                  />
                </Field>
                <Field
                  label="Delivery fee ($)"
                  htmlFor={`${location.code}-fee`}
                  hint="0 for free delivery."
                >
                  <Input
                    id={`${location.code}-fee`}
                    name="deliveryFee"
                    defaultValue={dollars(location.deliveryFeeCents)}
                    inputMode="decimal"
                  />
                </Field>
              </div>
            </SettingsForm>
          </Section>
        );
      })}

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
