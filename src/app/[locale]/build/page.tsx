import { Share2 } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AddBuildButtons } from "@/components/builder/add-build-buttons";
import { BuildSummary } from "@/components/builder/build-summary";
import { SaveBuildForm } from "@/components/builder/save-build-form";
import { SlotList } from "@/components/builder/slot-list";
import { Builder3D } from "@/components/builder3d/builder-3d";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LOCATION_CODES } from "@/lib/catalog/product-input";
import { formatMoney } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { getAssemblyExtras, getMyBuild, type BuildView } from "@/server/builder";
import { builderData } from "@/server/builder-3d";
import { getCustomer } from "@/server/customer";
import { localeAlternates } from "@/server/seo";

import { clearAction, locationAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Builder");
  return {
    title: t("title"),
    description: t("lead"),
    alternates: await localeAlternates("/build"),
  };
}

type Props = PageProps<"/[locale]/build">;

export default async function BuilderPage({ searchParams }: Props) {
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
        <Builder searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Builder({ searchParams }: Pick<Props, "searchParams">) {
  const [params, build, extras, t, catalog, locale, customer, t3d] = await Promise.all([
    searchParams,
    getMyBuild(),
    getAssemblyExtras(),
    getTranslations("Builder"),
    getTranslations("Catalog"),
    getLocale(),
    getCustomer(),
    getTranslations("Builder3D"),
  ]);
  // The 3D builder is a preview for now: /build?view=3d.
  const is3d = params.view === "3d";
  const empty: BuildView = {
    id: "",
    shareId: "",
    location: "TOR",
    featured: false,
    position: 0,
    name: null,
    userId: null,
    updatedAt: new Date(0),
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
      <div className="flex min-w-0 flex-col gap-4">
        <nav aria-label={t3d("viewLabel")} className="flex gap-1 self-start rounded-lg border p-1">
          {[
            { key: "list", href: "/build", label: t3d("viewList"), active: !is3d },
            { key: "3d", href: "/build?view=3d", label: t3d("view3d"), active: is3d },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                tab.active ? "bg-surface-raised font-medium" : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.key === "3d" && (
                <span className="rounded-full border border-accent/50 px-1.5 text-[10px] text-accent uppercase">
                  {t3d("beta")}
                </span>
              )}
            </Link>
          ))}
        </nav>
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
                {/* A saved build stays in the account; this starts a new one. */}
                {view.userId ? t("newBuild") : t("clear")}
              </Button>
            </form>
          )}
        </div>
        {is3d ? (
          <Builder3D data={builderData(build, locale)} listHref="/build" />
        ) : (
          <SlotList build={view} editable />
        )}
        {hasParts &&
          (customer ? (
            <SaveBuildForm locale={locale} name={view.userId === customer.id ? view.name : null} />
          ) : (
            <p className="rounded-lg border bg-surface p-4 text-sm text-muted">
              <a
                href={`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/build`)}`}
                className="text-accent underline underline-offset-2"
              >
                {t("signInToSave")}
              </a>
            </p>
          ))}
        {hasParts && (
          <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Share2 aria-hidden="true" className="size-4 text-accent" />
              {t("share")}
            </p>
            <input
              readOnly
              aria-label={t("share")}
              value={`${siteUrl()}/${locale}/build/s/${view.shareId}`}
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
