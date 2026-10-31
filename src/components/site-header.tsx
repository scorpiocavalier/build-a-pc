import { Search, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";

import { CartLink, CartLinkFallback } from "@/components/cart/cart-link";
import { LocaleSwitcher, LocaleSwitcherFallback } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";

const navLink =
  "rounded-lg px-2 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground min-[400px]:px-3";

export function SiteHeader() {
  const t = useTranslations("Header");
  const locale = useLocale();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-0 px-4 min-[400px]:gap-1 sm:gap-2">
        <Link href="/" aria-label={t("home")} className="mr-auto shrink-0 lg:mr-4">
          <Logo className="text-sm min-[400px]:text-base sm:text-lg" />
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/shop" className={navLink}>
            {/* Icon only on the narrowest phones so the header fits. */}
            <Store aria-hidden="true" className="size-5 min-[400px]:hidden" />
            <span className="max-[399px]:sr-only">{t("nav.shop")}</span>
          </Link>
          <Link href="/build" className={`${navLink} hidden md:block`}>
            {t("nav.builder")}
          </Link>
          <Link href="/prebuilt" className={`${navLink} hidden lg:block`}>
            {t("nav.prebuilt")}
          </Link>
        </nav>
        <form
          action={`/${locale}/search`}
          role="search"
          className="relative ml-auto hidden w-56 md:block"
        >
          <label htmlFor="header-q" className="sr-only">
            {t("searchLabel")}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <input
            id="header-q"
            name="q"
            type="search"
            placeholder={t("searchPlaceholder")}
            className="h-9 w-full rounded-lg border bg-surface pr-3 pl-9 text-sm"
          />
        </form>
        <Link
          href="/search"
          aria-label={t("searchLabel")}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-raised hover:text-foreground min-[400px]:p-2 md:hidden"
        >
          <Search aria-hidden="true" className="size-5" />
        </Link>
        <Suspense fallback={<CartLinkFallback />}>
          <CartLink />
        </Suspense>
        {/* The switcher reads the current URL, so it streams in on dynamic pages. */}
        <Suspense fallback={<LocaleSwitcherFallback />}>
          <LocaleSwitcher />
        </Suspense>
      </div>
    </header>
  );
}
