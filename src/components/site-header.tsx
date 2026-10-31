import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";

export function SiteHeader() {
  const t = useTranslations("Header");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label={t("home")}>
          <Logo className="text-base sm:text-lg" />
        </Link>
        <nav className="flex items-center gap-1">
          <a
            href="#builds"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground sm:block"
          >
            {t("nav.builds")}
          </a>
          <a
            href="#locations"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground sm:block"
          >
            {t("nav.locations")}
          </a>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
