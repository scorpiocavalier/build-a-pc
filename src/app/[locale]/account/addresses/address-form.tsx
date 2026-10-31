"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PROVINCES } from "@/lib/account/address-input";

import { saveAddressAction, type AddressState } from "../actions";

export type AddressFormValues = Partial<
  Record<"id" | "name" | "phone" | "line1" | "line2" | "city" | "province" | "postalCode", string>
> & { isDefault?: boolean };

export function AddressForm({ locale, initial }: { locale: string; initial: AddressFormValues }) {
  const t = useTranslations("Account");
  const checkout = useTranslations("Checkout");
  const [state, action, pending] = useActionState<AddressState, FormData>(saveAddressAction, {});
  const values: Record<string, string | undefined> = state.values ?? {
    ...initial,
    isDefault: initial.isDefault ? "on" : "",
  };
  const errors = state.errors ?? {};
  const field = (key: string) => ({
    id: `address-${key}`,
    name: key,
    defaultValue: values[key] ?? "",
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `address-${key}-error` : undefined,
  });
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);

  return (
    <form
      key={`${state.saved ?? ""}${JSON.stringify(state.values ?? {})}`}
      action={action}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="locale" value={locale} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.formError && (
        <p role="alert" className="text-sm text-red-300 sm:col-span-2">
          {t(`errors.${state.formError}`)}
        </p>
      )}
      <Field label={checkout("name")} htmlFor="address-name" error={err("name")}>
        <Input {...field("name")} autoComplete="name" />
      </Field>
      <Field label={checkout("phone")} htmlFor="address-phone" error={err("phone")}>
        <Input {...field("phone")} type="tel" autoComplete="tel" />
      </Field>
      <Field
        label={checkout("line1")}
        htmlFor="address-line1"
        error={err("line1")}
        className="sm:col-span-2"
      >
        <Input {...field("line1")} autoComplete="address-line1" />
      </Field>
      <Field label={checkout("line2")} htmlFor="address-line2">
        <Input {...field("line2")} autoComplete="address-line2" />
      </Field>
      <Field label={checkout("city")} htmlFor="address-city" error={err("city")}>
        <Input {...field("city")} autoComplete="address-level2" />
      </Field>
      <Field label={t("province")} htmlFor="address-province" error={err("province")}>
        <Select {...field("province")} defaultValue={values.province || "ON"}>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {t(`provinces.${p}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={checkout("postalCode")} htmlFor="address-postalCode" error={err("postalCode")}>
        <Input {...field("postalCode")} autoComplete="postal-code" className="uppercase" />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={values.isDefault === "on"}
          className="size-4 accent-[var(--accent)]"
        />
        {t("makeDefault")}
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" disabled={pending}>
          {initial.id ? t("save") : t("addAddress")}
        </Button>
        <p role="status" className="text-sm text-emerald-300">
          {state.saved ? t("saved") : ""}
        </p>
      </div>
    </form>
  );
}
