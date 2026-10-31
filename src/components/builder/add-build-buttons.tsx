"use client";

import { Check, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { addBuildAction, type AddBuildState } from "@/app/[locale]/build/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function AddBuildButtons({
  canAssemble,
  hasParts,
  assembleLabel,
}: {
  canAssemble: boolean;
  hasParts: boolean;
  assembleLabel: string;
}) {
  const t = useTranslations("Builder");
  const [state, action, pending] = useActionState<AddBuildState, FormData>(addBuildAction, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button name="mode" value="assembled" disabled={!canAssemble || pending}>
        <Wrench aria-hidden="true" className="size-4" />
        {assembleLabel}
      </Button>
      <Button name="mode" value="parts" variant="outline" disabled={!hasParts || pending}>
        {t("addParts")}
      </Button>
      <p role="status" className="min-h-5 text-sm">
        {state.added && (
          <span className="flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-4 text-emerald-400" />
            {state.added === "assembled" ? t("buildAdded") : t("partsAdded")}{" "}
            <Link href="/cart" className="text-accent underline underline-offset-2">
              {t("viewCart")}
            </Link>
          </span>
        )}
        {state.error === "incompatible" && (
          <span className="text-red-300">{t("assembleBlocked")}</span>
        )}
      </p>
    </form>
  );
}
