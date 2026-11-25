"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { menuLink } from "@/components/nav-links";
import { Link, usePathname } from "@/i18n/navigation";

const className =
  "rounded-lg px-1 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground min-[360px]:px-2 sm:px-3";

// "header" is the link in the header; "menu" is a row in the mobile menu.
type Variant = "header" | "menu";

// Phones show "FR"/"EN" in the header so it fits. The accessible name starts
// with that visible text (WCAG 2.5.3), then says what the link does.
function Label({ other, text, variant }: { other: string; text: string; variant: Variant }) {
  if (variant === "menu") {
    return (
      <>
        <Languages aria-hidden="true" className="size-5" />
        <span>{text}</span>
      </>
    );
  }
  return (
    <>
      <span className="sm:hidden">{other.toUpperCase()}</span>
      <span className="hidden sm:inline">{text}</span>
    </>
  );
}

function useOtherLocale(variant: Variant) {
  const t = useTranslations("Header");
  const other = useLocale() === "en" ? "fr" : "en";
  const text = t("switchLocale");
  const visible = variant === "menu" ? text : other.toUpperCase();
  return {
    other,
    text,
    label: `${visible} – ${t("switchLocaleLabel")}`,
    className: variant === "menu" ? menuLink : className,
  };
}

export function LocaleSwitcher({ variant = "header" }: { variant?: Variant }) {
  const { other, text, label, className } = useOtherLocale(variant);
  const pathname = usePathname();

  return (
    <Link href={pathname} locale={other} lang={other} aria-label={label} className={className}>
      <Label other={other} text={text} variant={variant} />
    </Link>
  );
}

// Shown until the current path is known: links to the other language's home.
export function LocaleSwitcherFallback({ variant = "header" }: { variant?: Variant }) {
  const { other, text, label, className } = useOtherLocale(variant);

  return (
    <Link href="/" locale={other} lang={other} aria-label={label} className={className}>
      <Label other={other} text={text} variant={variant} />
    </Link>
  );
}
