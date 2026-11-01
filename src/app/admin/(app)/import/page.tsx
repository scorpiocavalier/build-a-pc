import { Download } from "lucide-react";

import { CATEGORIES } from "@/lib/specs/definitions";
import type { SpecField } from "@/lib/specs/types";
import { requireAdmin } from "@/server/require-admin";

import { ImportForm } from "./import-form";

export const metadata = { title: "CSV import" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const BASE_HELP: [string, string][] = [
  ["sku", "Required. Your unique code. Rows with an existing SKU update that product."],
  ["category", "Required. Already filled in by the template."],
  ["brand", "Required. New brands are created automatically."],
  ["name_en / name_fr", "English name is required. French can be blank for now."],
  ["description_en / description_fr", "Optional."],
  ["price / compare_at_price", "Dollars, e.g. 549.99 (549,99 also works)."],
  ["status", "DRAFT (hidden), ACTIVE (on the store) or ARCHIVED. Blank means DRAFT."],
  ["warranty_months", "Optional whole number."],
  ["stock_TOR / stock_MTL", "Units on hand. Blank leaves the current stock unchanged."],
];

function describe(field: SpecField): string {
  const required = field.required
    ? "Required. "
    : field.requiredWhen
      ? `Required when ${field.requiredWhen.key} is ${field.requiredWhen.equals}. `
      : "";
  switch (field.type) {
    case "enum":
      return `${required}One of: ${field.options.map((o) => o.value).join(", ")}`;
    case "multiEnum":
      return `${required}Any of: ${field.options.map((o) => o.value).join(", ")} (separate with |)`;
    case "boolean":
      return `${required}yes or no`;
    case "int":
      return `${required}Whole number${field.unit ? ` in ${field.unit}` : ""}`;
    case "decimal":
      return `${required}Number${field.unit ? ` in ${field.unit}` : ""}`;
    case "text":
      return `${required}Text`;
  }
}

export default async function ImportPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">CSV import</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Add or update many products at once. Download a template for a category, fill it in with
          Excel, Numbers or Google Sheets, save as CSV, then check and import it here. A file can
          mix categories as long as each row has the right columns.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border bg-surface/60 p-5">
        <h2 className="font-semibold">1. Download a template</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c.slug} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
              <span className="font-medium">{c.name.en}</span>
              <a
                href={`/admin/import/csv/${c.slug}`}
                className="flex items-center gap-1 text-accent underline underline-offset-2"
              >
                <Download aria-hidden="true" className="size-3.5" /> Empty template
              </a>
              <a
                href={`/admin/import/csv/${c.slug}?export=1`}
                className="flex items-center gap-1 text-accent underline underline-offset-2"
              >
                <Download aria-hidden="true" className="size-3.5" /> Current products
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border bg-surface/60 p-5">
        <h2 className="font-semibold">2. Check and import</h2>
        <p className="text-sm text-muted">
          Checking never changes anything. If any row has a problem, nothing is imported.
        </p>
        <ImportForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Column reference</h2>
        <details className="rounded-lg border bg-surface/60 p-4" open>
          <summary className="cursor-pointer font-medium">Columns in every template</summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
            {BASE_HELP.map(([column, help]) => (
              <div key={column} className="contents">
                <dt className="font-mono text-xs">{column}</dt>
                <dd className="text-muted">{help}</dd>
              </div>
            ))}
          </dl>
        </details>
        {CATEGORIES.map((c) => (
          <details key={c.slug} className="rounded-lg border bg-surface/60 p-4">
            <summary className="cursor-pointer font-medium">{c.name.en} spec columns</summary>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
              {c.fields.map((field) => (
                <div key={field.key} className="contents">
                  <dt className="font-mono text-xs">spec.{field.key}</dt>
                  <dd className="text-muted">
                    <span className="text-foreground">{field.label.en}.</span> {describe(field)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </section>
    </div>
  );
}
