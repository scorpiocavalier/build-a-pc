import { Zap } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import type { AssemblyExtras, BuildView } from "@/server/builder";

import { IssueList } from "./issue-list";

// Price, power and compatibility for a build. Used by the builder and by
// shared and prebuilt build pages.
export async function BuildSummary({
  build,
  extras,
  children,
}: {
  build: BuildView;
  extras: AssemblyExtras;
  children?: ReactNode;
}) {
  const [t, locale] = await Promise.all([getTranslations("Builder"), getLocale()]);
  const money = (cents: number) => formatMoney(cents, locale);
  const assembledTotal = build.partsCents + extras.feeCents + (extras.windows?.priceCents ?? 0);
  const hasParts = Object.keys(build.items).length > 0;

  return (
    <aside
      aria-label={t("summary")}
      className="flex h-fit flex-col gap-4 rounded-lg border bg-surface p-5 lg:sticky lg:top-20"
    >
      <h2 className="font-semibold">{t("summary")}</h2>
      <dl className="flex flex-col gap-1 text-sm">
        <Row label={t("parts")} value={money(build.partsCents)} />
        <Row label={t("assembly")} value={money(extras.feeCents)} />
        {extras.windows && (
          <Row
            label={localize(extras.windows.name, locale)}
            value={money(extras.windows.priceCents)}
          />
        )}
        <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
          <dt>{t("estimatedTotal")}</dt>
          <dd className="tabular-nums">{money(assembledTotal)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">{t("taxNote")}</p>
      {hasParts && (
        <p className="flex items-center gap-2 text-sm">
          <Zap aria-hidden="true" className="size-4 text-accent" />
          {t("wattage", { watts: build.wattage })}
        </p>
      )}
      <section aria-labelledby="compat" className="flex flex-col gap-2">
        <h3 id="compat" className="text-sm font-semibold">
          {t("issuesTitle")}
        </h3>
        {hasParts ? (
          <IssueList issues={build.issues} />
        ) : (
          <p className="text-sm text-muted">{t("empty")}</p>
        )}
        {hasParts && build.missing.length > 0 && (
          <p className="text-sm text-muted">
            {t("missing", { slots: build.missing.map((slot) => t(`slots.${slot}`)).join(", ") })}
          </p>
        )}
      </section>
      {children}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
