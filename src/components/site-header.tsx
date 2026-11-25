import { Mail, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CartLink, CartLinkFallback } from "@/components/cart/cart-link";
import { LocaleSwitcher, LocaleSwitcherFallback } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLink } from "@/components/nav-link";
import { menuLink, NAV_LINKS } from "@/components/nav-links";
import { SearchForm } from "@/components/search-form";
import { Link } from "@/i18n/navigation";
import { getSettings } from "@/server/settings";

const navLink =
  "rounded-lg px-1 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground min-[360px]:px-2 sm:px-3";

// Footer pages that phones also reach from the menu.
const SECONDARY_LINKS = ["locations", "returns", "warranty"] as const;

async function ContactLink() {
  const [t, settings] = await Promise.all([getTranslations("Footer"), getSettings()]);
  return (
    <a href={`mailto:${settings.contactEmail}`} className={`${menuLink} break-all`}>
      <Mail aria-hidden="true" className="size-5 shrink-0" />
      {t("contact", { email: settings.contactEmail })}
    </a>
  );
}

export function SiteHeader() {
  const t = useTranslations("Header");
  const tFooter = useTranslations("Footer");
  const links = NAV_LINKS.map(({ href, labelKey }) => ({ href, label: t(labelKey) }));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-0 px-4 min-[400px]:gap-1 sm:gap-2">
        <Link href="/" aria-label={t("home")} className="mr-auto shrink-0 lg:mr-4">
          <Logo className="text-sm min-[400px]:text-base sm:text-lg" />
        </Link>
        {/* Below lg, these links are in the menu. NavLink reads the URL to
            mark the current page, so plain links show until it's known. */}
        <Suspense
          fallback={
            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className={navLink}>
                  {link.label}
                </Link>
              ))}
            </nav>
          }
        >
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href} className={navLink}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </Suspense>
        <SearchForm id="header-q" className="ml-auto hidden w-56 md:block" />
        <div className="hidden lg:contents">
          <Link
            href="/account"
            aria-label={t("nav.account")}
            className="rounded-lg p-1 text-muted hover:bg-surface-raised hover:text-foreground min-[360px]:p-1.5 min-[400px]:p-2"
          >
            <UserRound aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <Suspense fallback={<CartLinkFallback />}>
          <CartLink />
        </Suspense>
        <div className="hidden lg:contents">
          {/* The switcher reads the current URL, so it streams in on dynamic pages. */}
          <Suspense fallback={<LocaleSwitcherFallback />}>
            <LocaleSwitcher />
          </Suspense>
        </div>
        <MobileMenu
          labels={{ menu: t("menu"), close: t("closeMenu") }}
          links={links}
          search={<SearchForm id="menu-q" inputClassName="h-11 text-base" />}
        >
          <ul className="flex flex-col gap-1 border-t pt-4">
            <li>
              <NavLink href="/account" className={menuLink}>
                <UserRound aria-hidden="true" className="size-5" />
                {t("nav.account")}
              </NavLink>
            </li>
            <li>
              <Suspense fallback={<CartLinkFallback variant="menu" />}>
                <CartLink variant="menu" />
              </Suspense>
            </li>
            <li>
              <Suspense fallback={<LocaleSwitcherFallback variant="menu" />}>
                <LocaleSwitcher variant="menu" />
              </Suspense>
            </li>
          </ul>
          <ul className="flex flex-col gap-1 border-t pt-4">
            {SECONDARY_LINKS.map((key) => (
              <li key={key}>
                <NavLink href={`/${key}`} className={menuLink}>
                  {tFooter(key)}
                </NavLink>
              </li>
            ))}
            <li>
              <ContactLink />
            </li>
          </ul>
        </MobileMenu>
      </div>
    </header>
  );
}
