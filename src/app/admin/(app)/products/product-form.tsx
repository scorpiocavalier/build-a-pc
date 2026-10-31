"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  LOCATION_CODES,
  PRODUCT_STATUSES,
  SPEC_PREFIX,
  type RawProductInput,
} from "@/lib/catalog/product-input";
import type { CategoryDefinition, SpecField } from "@/lib/specs/types";

import { saveProductAction, type ProductFormState } from "./actions";

const LOCATION_NAMES = { TOR: "Toronto", MTL: "Montreal" } as const;

export function ProductForm({
  productId,
  definition,
  initial,
  brands,
}: {
  productId: string | null;
  definition: CategoryDefinition;
  initial: RawProductInput;
  brands: string[];
}) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(
    saveProductAction.bind(null, productId),
    {},
  );
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const str = (key: string) => {
    const v = values[key];
    return Array.isArray(v) ? v.join("|") : (v ?? "");
  };
  const fieldProps = (key: string) => ({
    id: key,
    name: key,
    defaultValue: str(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  });

  return (
    // Re-mount after each submit so inputs show the values that came back.
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-8">
      <input type="hidden" name="category" value={definition.slug} />

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
          Please fix the {Object.keys(errors).length === 1 ? "error" : "errors"} below.
        </p>
      )}

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name (English)" htmlFor="name_en" error={errors.name_en}>
            <Input {...fieldProps("name_en")} required />
          </Field>
          <Field
            label="Name (French)"
            htmlFor="name_fr"
            error={errors.name_fr}
            hint="Leave blank to show the English name on the French site for now."
          >
            <Input {...fieldProps("name_fr")} lang="fr" />
          </Field>
          <Field label="Brand" htmlFor="brand" error={errors.brand}>
            <Input {...fieldProps("brand")} list="brand-options" required />
            <datalist id="brand-options">
              {brands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select {...fieldProps("status")}>
              {PRODUCT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "DRAFT"
                    ? "Draft (hidden)"
                    : status === "ACTIVE"
                      ? "Active (on the store)"
                      : "Archived"}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Description (English)"
            htmlFor="description_en"
            error={errors.description_en}
          >
            <Textarea {...fieldProps("description_en")} />
          </Field>
          <Field
            label="Description (French)"
            htmlFor="description_fr"
            error={errors.description_fr}
          >
            <Textarea {...fieldProps("description_fr")} lang="fr" />
          </Field>
        </div>
      </Section>

      <Section title="Identifiers">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="SKU"
            htmlFor="sku"
            error={errors.sku}
            hint="Your internal code, e.g. GPU-MSI-5070"
          >
            <Input {...fieldProps("sku")} required autoCapitalize="characters" />
          </Field>
          <Field label="Manufacturer part number" htmlFor="mpn" error={errors.mpn}>
            <Input {...fieldProps("mpn")} />
          </Field>
          <Field label="UPC" htmlFor="upc" error={errors.upc}>
            <Input {...fieldProps("upc")} inputMode="numeric" />
          </Field>
        </div>
      </Section>

      <Section title="Price, warranty and stock">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price (CAD)" htmlFor="price" error={errors.price}>
            <Input {...fieldProps("price")} inputMode="decimal" placeholder="549.99" required />
          </Field>
          <Field
            label="Compare-at price (CAD)"
            htmlFor="compare_at_price"
            error={errors.compare_at_price}
            hint="Optional. Shown crossed out when higher than the price."
          >
            <Input {...fieldProps("compare_at_price")} inputMode="decimal" />
          </Field>
          <Field
            label="Manufacturer warranty (months)"
            htmlFor="warranty_months"
            error={errors.warranty_months}
          >
            <Input {...fieldProps("warranty_months")} inputMode="numeric" />
          </Field>
          {LOCATION_CODES.map((code) => (
            <Field
              key={code}
              label={`Stock on hand: ${LOCATION_NAMES[code]}`}
              htmlFor={`stock_${code}`}
              error={errors[`stock_${code}`]}
            >
              <Input {...fieldProps(`stock_${code}`)} inputMode="numeric" />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Changing stock records an adjustment in the inventory history.
        </p>
      </Section>

      <Section title={`Specifications: ${definition.name.en}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {definition.fields.map((field) => (
            <SpecInput
              key={field.key}
              field={field}
              value={values[SPEC_PREFIX + field.key]}
              error={errors[SPEC_PREFIX + field.key]}
            />
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur">
        <Button disabled={pending}>
          {pending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
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

function SpecInput({
  field,
  value,
  error,
}: {
  field: SpecField;
  value: string | string[] | undefined;
  error?: string;
}) {
  const id = SPEC_PREFIX + field.key;
  const required = field.required || field.requiredWhen;
  const label = (
    <>
      {field.label.en}
      {"unit" in field && field.unit ? ` (${field.unit})` : ""}
      {required ? "" : <span className="font-normal text-muted"> (optional)</span>}
    </>
  );
  const hint = field.requiredWhen
    ? `Required when ${field.requiredWhen.key} is ${field.requiredWhen.equals}.`
    : undefined;
  const common = {
    id,
    name: id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  const text = Array.isArray(value) ? value.join("|") : (value ?? "");

  switch (field.type) {
    case "enum":
      return (
        <Field label={label} htmlFor={id} error={error} hint={hint}>
          <Select {...common} defaultValue={text}>
            <option value="">—</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label?.en ?? o.value}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "multiEnum": {
      const selected = Array.isArray(value) ? value : text.split("|").filter(Boolean);
      return (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">{label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {field.options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`${id}[]`}
                  value={o.value}
                  defaultChecked={selected.includes(o.value)}
                  className="size-4 accent-[var(--accent)]"
                />
                {o.label?.en ?? o.value}
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </fieldset>
      );
    }
    case "boolean":
      return (
        <Field label={label} htmlFor={id} error={error} hint={hint}>
          <Select
            {...common}
            defaultValue={text === "true" ? "yes" : text === "false" ? "no" : text}
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </Field>
      );
    case "int":
    case "decimal":
      return (
        <Field label={label} htmlFor={id} error={error} hint={hint}>
          <Input
            {...common}
            defaultValue={text}
            inputMode={field.type === "int" ? "numeric" : "decimal"}
          />
        </Field>
      );
    case "text":
      return (
        <Field label={label} htmlFor={id} error={error} hint={hint}>
          <Input {...common} defaultValue={text} />
        </Field>
      );
  }
}
