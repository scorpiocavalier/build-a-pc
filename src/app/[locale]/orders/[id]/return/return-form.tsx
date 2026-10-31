"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { RETURN_REASONS } from "@/lib/returns/eligibility";

import { requestReturnAction, type ReturnFormState } from "./actions";

export type ReturnFormLine = {
  id: string;
  name: string;
  returnable: number;
  // Heading for the parts of an assembled PC, shown above its first part.
  group: string | null;
};

export function ReturnForm({
  locale,
  orderId,
  token,
  lines,
}: {
  locale: string;
  orderId: string;
  token: string;
  lines: ReturnFormLine[];
}) {
  const t = useTranslations("Returns");
  const [state, action, pending] = useActionState<ReturnFormState, FormData>(
    requestReturnAction,
    {},
  );
  const values = state.values ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t("whichItems")}</legend>
        <ul className="flex flex-col divide-y rounded-lg border bg-surface">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-1 p-3">
              {line.group && (
                <span className="text-xs font-semibold tracking-wide text-accent uppercase">
                  {line.group}
                </span>
              )}
              <div className="flex items-center gap-3">
                <label htmlFor={`qty-${line.id}`} className="flex-1 text-sm">
                  {line.name}
                </label>
                <select
                  id={`qty-${line.id}`}
                  name={`qty_${line.id}`}
                  defaultValue={values[`qty_${line.id}`] ?? "0"}
                  disabled={line.returnable === 0}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  {Array.from({ length: line.returnable + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <Field label={t("reason")} htmlFor="return-reason">
        <Select id="return-reason" name="reason" defaultValue={values.reason ?? ""} required>
          <option value="">—</option>
          {RETURN_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {t(`reasons.${reason}`)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t("details")} htmlFor="return-details" hint={t("detailsHint")}>
        <Textarea
          id="return-details"
          name="details"
          defaultValue={values.details ?? ""}
          minLength={10}
          maxLength={2000}
          required
        />
      </Field>

      <Button disabled={pending} className="self-start">
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
