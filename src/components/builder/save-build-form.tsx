"use client";

import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { saveBuildAction, type SaveBuildState } from "@/app/[locale]/account/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function SaveBuildForm({ locale, name }: { locale: string; name: string | null }) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState<SaveBuildState, FormData>(saveBuildAction, {});

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="build-name" className="flex items-center gap-2 font-medium">
        <Bookmark aria-hidden="true" className="size-4 text-accent" />
        {name ? t("savedBuildTitle") : t("saveBuildTitle")}
      </label>
      <div className="flex gap-2">
        <input
          id="build-name"
          name="name"
          defaultValue={name ?? ""}
          maxLength={80}
          placeholder={t("buildNamePlaceholder")}
          aria-invalid={state.error ? true : undefined}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3"
        />
        <Button size="sm" disabled={pending}>
          {name ? t("rename") : t("saveBuild")}
        </Button>
      </div>
      <p role="status" className="text-xs text-muted">
        {state.error ? (
          <span className="text-red-300">{t(`buildErrorsForm.${state.error}`)}</span>
        ) : name ? (
          <>
            {t("savedBuildHint")}{" "}
            <Link href="/account/builds" className="text-accent underline underline-offset-2">
              {t("tabs.builds")}
            </Link>
          </>
        ) : (
          t("saveBuildHint")
        )}
      </p>
    </form>
  );
}
