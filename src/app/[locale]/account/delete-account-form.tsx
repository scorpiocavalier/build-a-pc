"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { deleteAccountAction, type DeleteAccountState } from "./actions";

export function DeleteAccountForm({ locale }: { locale: string }) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirm"
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        {t("deleteConfirm")}
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-300">
          {t(`deleteErrors.${state.error}`)}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className="self-start border-red-400/50 text-red-300"
      >
        {t("deleteAccount")}
      </Button>
    </form>
  );
}
