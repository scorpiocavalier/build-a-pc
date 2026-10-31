import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", href: "/account" },
  { key: "orders", href: "/account/orders" },
  { key: "builds", href: "/account/builds" },
  { key: "wishlist", href: "/account/wishlist" },
  { key: "addresses", href: "/account/addresses" },
] as const;

export type AccountTab = (typeof TABS)[number]["key"];

// Heading and tab bar shared by the account pages.
export async function AccountShell({
  current,
  children,
}: {
  current: AccountTab;
  children: ReactNode;
}) {
  const t = await getTranslations("Account");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <nav aria-label={t("title")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b">
          {TABS.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                  tab.key === current
                    ? "border-accent font-medium text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}

export function AccountFallback() {
  return <div aria-hidden="true" className="h-64 animate-pulse rounded-lg bg-surface" />;
}
