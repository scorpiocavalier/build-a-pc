"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

import { saveProfileAction, type ProfileState } from "./actions";

export function ProfileForm({
  locale,
  name,
  preferredLocale,
}: {
  locale: string;
  name: string;
  preferredLocale: string;
}) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("name")} htmlFor="profile-name">
        <Input id="profile-name" name="name" defaultValue={name} autoComplete="name" />
      </Field>
      <Field label={t("language")} htmlFor="profile-locale" hint={t("languageHint")}>
        <Select id="profile-locale" name="preferredLocale" defaultValue={preferredLocale}>
          <option value="en">English</option>
          <option value="fr">Français</option>
        </Select>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" disabled={pending}>
          {t("save")}
        </Button>
        <p role="status" className="text-sm text-emerald-300">
          {state.saved ? t("saved") : ""}
        </p>
      </div>
    </form>
  );
}
