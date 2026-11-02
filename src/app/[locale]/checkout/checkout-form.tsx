"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { SLOTS } from "@/lib/checkout/windows";
import { cn } from "@/lib/utils";

import { placeOrderAction, type CheckoutState } from "./actions";

export type CheckoutFormProps = {
  locale: string;
  fulfilment: "PICKUP" | "DELIVERY";
  locationCode: string;
  postalCode: string;
  dates: { value: string; label: string }[];
  methods: PaymentMethod[];
  etransferHours: number;
  cashLimitNote: string | null;
  // Assembled builds: deposit wording, overall and per payment method.
  depositNote: { general: string; CASH: string; ETRANSFER: string } | null;
  // Signed-in customers: contact details and a matching saved address.
  prefill: Record<string, string>;
  signedIn: boolean;
  // Return policy shown next to the terms box, from settings.
  returnDays: number;
  restockingPercent: number;
};

export function CheckoutForm(props: CheckoutFormProps) {
  const t = useTranslations("Checkout");
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  // "Place order" stays disabled until the browser says every required field
  // is filled in (the `required` and `pattern` attributes below). Unknown
  // until the page runs JavaScript, so the button works without it too; the
  // server checks everything again either way.
  const formRef = useRef<HTMLFormElement>(null);
  const [complete, setComplete] = useState<boolean | null>(null);
  const recheck = () => setComplete(formRef.current?.checkValidity() ?? null);
  useEffect(recheck, [state]);
  const values = state.values ?? props.prefill;
  const errors = state.errors ?? {};
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);
  const field = (key: string) => ({
    id: key,
    name: key,
    defaultValue: values[key] ?? "",
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  });
  const delivery = props.fulfilment === "DELIVERY";
  const defaultMethod = values.method ?? props.methods[0];

  return (
    <form
      key={JSON.stringify(values)}
      ref={formRef}
      action={action}
      onInput={recheck}
      onChange={recheck}
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="fulfilment" value={props.fulfilment} />
      <input type="hidden" name="location" value={props.locationCode} />
      <input type="hidden" name="postalCode" value={props.postalCode} />

      {(state.formError || Object.keys(errors).length > 0) && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
          {state.formError ? t(`errors.${state.formError}`) : t("errors.required")}
        </p>
      )}

      <p className="text-sm text-muted">{t("requiredNote")}</p>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-lg font-semibold">{t("contact")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("name")}
            htmlFor="name"
            error={err("name")}
            className="sm:col-span-2"
            required
          >
            <Input {...field("name")} autoComplete="name" required />
          </Field>
          <Field label={t("email")} htmlFor="email" error={err("email")} required>
            <Input {...field("email")} type="email" autoComplete="email" required />
          </Field>
          <Field label={t("phone")} htmlFor="phone" error={err("phone")} required>
            <Input
              {...field("phone")}
              type="tel"
              autoComplete="tel"
              required
              // A 10-digit North American number in any format, as the server accepts.
              pattern="\D*(1\D*)?[2-9]\D*\d\D*\d\D*[2-9](\D*\d){6}\D*"
            />
          </Field>
        </div>
      </fieldset>

      {delivery && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-lg font-semibold">{t("address")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("line1")}
              htmlFor="line1"
              error={err("line1")}
              className="sm:col-span-2"
              required
            >
              <Input {...field("line1")} autoComplete="address-line1" required />
            </Field>
            <Field label={t("line2")} htmlFor="line2">
              <Input {...field("line2")} autoComplete="address-line2" />
            </Field>
            <Field label={t("city")} htmlFor="city" error={err("city")} required>
              <Input {...field("city")} autoComplete="address-level2" required />
            </Field>
            <Field label={t("postalCode")} htmlFor="postal-display">
              <Input id="postal-display" value={props.postalCode} readOnly className="text-muted" />
            </Field>
          </div>
          {props.signedIn && !values.addressId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="saveAddress"
                defaultChecked={values.saveAddress === "on"}
                className="size-4 accent-[var(--accent)]"
              />
              {t("saveAddress")}
            </label>
          )}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">
          {delivery ? t("windowDelivery") : t("windowPickup")}
        </legend>
        <p className="text-sm text-muted">{t("windowHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("date")} htmlFor="date" error={err("window")} required>
            <Select {...field("date")} required>
              <option value="">—</option>
              {props.dates.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("slot")} htmlFor="slot" required>
            <Select {...field("slot")} required>
              <option value="">—</option>
              {SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {t(`slots.${slot}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">{t("payment")}</legend>
        {props.depositNote && (
          <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
            {props.depositNote.general}
          </p>
        )}
        {props.methods.map((method) => (
          <label
            key={method}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border bg-surface p-4 has-[:checked]:border-accent",
            )}
          >
            <input
              type="radio"
              name="method"
              value={method}
              defaultChecked={method === defaultMethod}
              required
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-medium">{t(`methods.${method}.title`)}</span>
              <span className="text-sm text-muted">
                {props.depositNote && method !== "CARD"
                  ? props.depositNote[method]
                  : t(`methods.${method}.description`, { hours: props.etransferHours })}
              </span>
            </span>
          </label>
        ))}
        {props.cashLimitNote && <p className="text-sm text-muted">{props.cashLimitNote}</p>}
        {err("method") && <p className="text-xs text-red-300">{err("method")}</p>}
      </fieldset>

      <Field label={t("notes")} htmlFor="notes">
        <Textarea {...field("notes")} maxLength={1000} />
      </Field>

      <div className="flex flex-col gap-1">
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            name="terms"
            defaultChecked={values.terms === "on"}
            required
            aria-invalid={errors.terms ? true : undefined}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            <span aria-hidden="true" className="mr-0.5 text-accent">
              *
            </span>
            {t.rich("terms", {
              days: props.returnDays,
              percent: props.restockingPercent,
              terms: (chunks) => (
                <Link href="/terms" target="_blank" className="text-accent underline">
                  {chunks}
                </Link>
              ),
              returns: (chunks) => (
                <Link href="/returns" target="_blank" className="text-accent underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {err("terms") && <p className="text-xs text-red-300">{err("terms")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          disabled={pending || complete === false}
          aria-describedby={complete === false ? "place-order-hint" : undefined}
          className="w-full sm:w-auto sm:self-start"
        >
          {pending ? t("placing") : t("placeOrder")}
        </Button>
        {complete === false && (
          <p id="place-order-hint" className="text-sm text-muted">
            {t("completeToOrder")}
          </p>
        )}
      </div>
    </form>
  );
}
