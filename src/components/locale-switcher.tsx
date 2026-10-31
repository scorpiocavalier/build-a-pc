"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

const className =
  "rounded-lg px-2 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground sm:px-3";

// Phones show "FR"/"EN" so the header fits; the aria-label always has the full text.
function Label({ other, text }: { other: string; text: string }) {
  return (
    <>
      <span className="sm:hidden">{other.toUpperCase()}</span>
      <span className="hidden sm:inline">{text}</span>
    </>
  );
}

function useOtherLocale() {
  const t = useTranslations("Header");
  const other = useLocale() === "en" ? "fr" : "en";
  return { other, text: t("switchLocale"), label: t("switchLocaleLabel") };
}

export function LocaleSwitcher() {
  const { other, text, label } = useOtherLocale();
  const pathname = usePathname();

  return (
    <Link href={pathname} locale={other} lang={other} aria-label={label} className={className}>
      <Label other={other} text={text} />
    </Link>
  );
}

// Shown until the current path is known: links to the other language's home.
export function LocaleSwitcherFallback() {
  const { other, text, label } = useOtherLocale();

  return (
    <Link href="/" locale={other} lang={other} aria-label={label} className={className}>
      <Label other={other} text={text} />
    </Link>
  );
}
