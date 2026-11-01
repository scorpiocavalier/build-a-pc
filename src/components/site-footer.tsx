import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { getSettings } from "@/server/settings";

async function currentYear() {
  "use cache";
  return new Date().getFullYear();
}

const LINKS = ["locations", "returns", "warranty", "privacy", "terms"] as const;

export async function SiteFooter() {
  const [t, year, settings] = await Promise.all([
    getTranslations("Footer"),
    currentYear(),
    getSettings(),
  ]);

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Logo className="text-foreground" />
            <a href={`mailto:${settings.contactEmail}`} className="hover:text-foreground">
              {t("contact", { email: settings.contactEmail })}
            </a>
          </div>
          <nav aria-label={t("nav")}>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
              {LINKS.map((key) => (
                <li key={key}>
                  <Link href={`/${key}`} className="hover:text-foreground">
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <p>{t("warranty")}</p>
          <p>{t("rights", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
