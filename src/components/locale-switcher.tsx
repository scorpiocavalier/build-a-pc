"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "en" ? "fr" : "en";

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      aria-label={t("switchLocaleLabel")}
      className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
    >
      {t("switchLocale")}
    </Link>
  );
}
