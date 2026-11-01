import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountFallback, AccountShell } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { listSavedBuilds } from "@/server/builder";
import { requireCustomer } from "@/server/customer";

import { deleteBuildAction, openBuildAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("tabs.builds"), robots: { index: false } };
}

export default function AccountBuildsPage() {
  return (
    <AccountShell current="builds">
      <Suspense fallback={<AccountFallback />}>
        <Builds />
      </Suspense>
    </AccountShell>
  );
}

async function Builds() {
  const locale = await getLocale();
  const customer = await requireCustomer(locale, `/${locale}/account/builds`);
  const [builds, t] = await Promise.all([listSavedBuilds(customer.id), getTranslations("Account")]);
  if (builds.length === 0) {
    return (
      <p className="rounded-lg border bg-surface p-6 text-muted">
        {t("noBuilds")}{" "}
        <Link href="/build" className="text-accent underline underline-offset-2">
          {t("openBuilder")}
        </Link>
      </p>
    );
  }
  const date = new Intl.DateTimeFormat(`${locale}-CA`, { dateStyle: "medium" });

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {builds.map((build) => {
        const parts = Object.values(build.items);
        const errors = build.issues.filter((i) => i.severity === "error").length;
        const ready = parts.length > 0 && errors === 0 && build.missing.length === 0;
        return (
          <li key={build.id} className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
            <div>
              <h2 className="font-semibold">{build.name}</h2>
              <p className="text-xs text-muted">
                {t("buildMeta", {
                  parts: parts.length,
                  date: date.format(build.updatedAt),
                })}
              </p>
            </div>
            <ul className="flex flex-col gap-0.5 text-sm text-muted">
              {(["CPU", "GPU"] as const).map(
                (slot) =>
                  build.items[slot] && (
                    <li key={slot}>
                      {build.items[slot].brand} {localize(build.items[slot].name, locale)}
                    </li>
                  ),
              )}
            </ul>
            <p className="flex items-center gap-1.5 text-sm">
              {ready ? (
                <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-400" />
              ) : (
                <AlertTriangle aria-hidden="true" className="size-4 text-amber-300" />
              )}
              {ready
                ? t("buildReady")
                : errors
                  ? t("buildErrors", { count: errors })
                  : t("buildIncomplete")}
            </p>
            <p className="font-semibold tabular-nums">{formatMoney(build.partsCents, locale)}</p>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <form action={openBuildAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={build.id} />
                <Button size="sm" aria-label={`${t("openBuild")}: ${build.name}`}>
                  {t("openBuild")}
                </Button>
              </form>
              <Link
                href={`/build/s/${build.shareId}`}
                className="text-sm text-accent underline underline-offset-2"
              >
                {t("shareLink")}
              </Link>
              <form action={deleteBuildAction} className="ml-auto">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={build.id} />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${t("delete")}: ${build.name}`}
                  className="text-red-300"
                >
                  {t("delete")}
                </Button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
