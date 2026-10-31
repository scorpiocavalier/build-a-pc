import { Share2 } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AddBuildButtons } from "@/components/builder/add-build-buttons";
import { BuildSummary } from "@/components/builder/build-summary";
import { SlotList } from "@/components/builder/slot-list";
import { Button } from "@/components/ui/button";
import { LOCATION_CODES } from "@/lib/catalog/product-input";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getAssemblyExtras, getMyBuild, type BuildView } from "@/server/builder";

import { clearAction, locationAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Builder");
  return { title: t("title"), description: t("lead") };
}

export default async function BuilderPage() {
  const t = await getTranslations("Builder");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("lead")}</p>
      </div>
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-lg bg-surface" />}
      >
        <Builder />
      </Suspense>
    </div>
  );
}

async function Builder() {
  const [build, extras, t, catalog, locale] = await Promise.all([
    getMyBuild(),
    getAssemblyExtras(),
    getTranslations("Builder"),
    getTranslations("Catalog"),
    getLocale(),
  ]);
  const empty: BuildView = {
    id: "",
    shareId: "",
    location: "TOR",
    featured: false,
    position: 0,
    title: null,
    description: null,
    items: {},
    issues: [],
    missing: [],
    wattage: 0,
    partsCents: 0,
  };
  const view = build ?? empty;
  const hasParts = Object.keys(view.items).length > 0;
  const canAssemble =
    hasParts && view.missing.length === 0 && !view.issues.some((i) => i.severity === "error");
  const assembledTotal = view.partsCents + extras.feeCents + (extras.windows?.priceCents ?? 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form action={locationAction} className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t("stockFor")}</span>
            {LOCATION_CODES.map((code) => (
              <Button
                key={code}
                name="location"
                value={code}
                size="sm"
                variant={view.location === code ? "primary" : "outline"}
                aria-pressed={view.location === code}
              >
                {catalog(`locations.${code}`)}
              </Button>
            ))}
          </form>
          {hasParts && (
            <form action={clearAction}>
              <Button size="sm" variant="ghost">
                {t("clear")}
              </Button>
            </form>
          )}
        </div>
        <SlotList build={view} editable />
        {hasParts && (
          <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Share2 aria-hidden="true" className="size-4 text-accent" />
              {t("share")}
            </p>
            <input
              readOnly
              aria-label={t("share")}
              value={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${locale}/build/s/${view.shareId}`}
              className="h-9 w-full rounded-lg border bg-background px-3 font-mono text-xs"
            />
            <p className="text-xs text-muted">{t("shareHint")}</p>
          </div>
        )}
      </div>
      <BuildSummary build={view} extras={extras}>
        <AddBuildButtons
          canAssemble={canAssemble}
          hasParts={hasParts}
          assembleLabel={`${t("assemble")} · ${formatMoney(assembledTotal, locale)}`}
        />
        <p className={cn("text-xs text-muted", !canAssemble && "hidden")}>
          {t("assembleNote", { days: extras.days })}
        </p>
      </BuildSummary>
    </div>
  );
}
