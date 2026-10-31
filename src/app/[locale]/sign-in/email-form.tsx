"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

import { emailSignInAction, type EmailSignInState } from "./actions";

export function EmailSignInForm({ locale, next }: { locale: string; next: string }) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState<EmailSignInState, FormData>(
    emailSignInAction,
    {},
  );

  if (state.sent) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border bg-surface p-5">
        <p className="flex items-center gap-2 font-semibold">
          <MailCheck aria-hidden="true" className="size-5 text-accent" />
          {t("checkEmail")}
        </p>
        <p className="text-sm text-muted">{t("checkEmailBody", { email: state.sent })}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <Field
        label={t("email")}
        htmlFor="sign-in-email"
        error={state.error ? t(`signInErrors.${state.error}`) : undefined}
      >
        <Input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "sign-in-email-error" : undefined}
        />
      </Field>
      <Button disabled={pending}>{pending ? t("sending") : t("sendLink")}</Button>
    </form>
  );
}
