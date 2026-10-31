import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/server/settings";

// When the policy text last changed. Update it with the wording.
export const LEGAL_UPDATED = "2026-10-31";

export type LegalPageKey = "returns" | "warranty" | "privacy" | "terms";

const RELATED: Record<LegalPageKey, LegalPageKey[]> = {
  returns: ["warranty", "terms"],
  warranty: ["returns", "terms"],
  privacy: ["terms"],
  terms: ["returns", "warranty", "privacy"],
};

// Policy pages: a title, intro and numbered sections from the message files,
// with the store's settings (return window, fee, contact) filled in.
export async function LegalPage({ page }: { page: LegalPageKey }) {
  const [t, footer, locale, settings] = await Promise.all([
    getTranslations("Legal"),
    getTranslations("Footer"),
    getLocale(),
    getSettings(),
  ]);
  const values = {
    days: settings.returnWindowDays,
    percent: settings.restockingPercent,
    email: settings.contactEmail,
    officer: settings.privacyOfficer || t("officerFallback"),
    cashMax: formatMoney(settings.cashMaxCents, locale),
    deposit: settings.depositPercent,
  };
  const sections = Object.keys(t.raw(`${page}.sections`) as Record<string, unknown>);
  const updated = new Intl.DateTimeFormat(`${locale}-CA`, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_UPDATED}T12:00:00Z`));

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t(`${page}.title`)}</h1>
        <p className="text-sm text-muted">{t("updated", { date: updated })}</p>
        <p className="text-lg text-muted">{t(`${page}.intro`)}</p>
      </header>
      <ol className="flex flex-col gap-6">
        {sections.map((key, i) => (
          <li key={key} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">
              {i + 1}. {t(`${page}.sections.${key}.title`)}
            </h2>
            {t(`${page}.sections.${key}.body`, values)
              .split("\n\n")
              .map((paragraph, j) => (
                <p key={j} className="text-muted">
                  {paragraph}
                </p>
              ))}
          </li>
        ))}
      </ol>
      <footer className="flex flex-col gap-2 border-t pt-6 text-sm">
        <p className="text-muted">{t("contactLine", { email: settings.contactEmail })}</p>
        <nav aria-label={t("related")} className="flex flex-wrap gap-x-4 gap-y-1">
          {RELATED[page].map((other) => (
            <Link
              key={other}
              href={`/${other}`}
              className="text-accent underline underline-offset-2"
            >
              {footer(other)}
            </Link>
          ))}
        </nav>
      </footer>
    </article>
  );
}
