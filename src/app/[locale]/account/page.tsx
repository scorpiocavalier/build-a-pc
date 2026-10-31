import { Heart, Monitor, Package } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AccountFallback, AccountShell } from "@/components/account/account-shell";
import { OrderList } from "@/components/account/order-list";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { listMyOrders } from "@/server/account/orders";
import { getCustomerProfile, requireCustomer } from "@/server/customer";
import { db } from "@/server/db";

import { signOutAction } from "./actions";
import { ProfileForm } from "./profile-form";

type Props = PageProps<"/[locale]/account">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("title"), robots: { index: false } };
}

export default function AccountPage({ searchParams }: Props) {
  return (
    <AccountShell current="overview">
      <Suspense fallback={<AccountFallback />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </AccountShell>
  );
}

async function Overview({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await getLocale();
  const customer = await requireCustomer(locale, `/${locale}/account`);
  const [params, profile, t, orders, counts] = await Promise.all([
    searchParams,
    getCustomerProfile(customer.id),
    getTranslations("Account"),
    listMyOrders(customer.id, 3),
    db.user.findUnique({
      where: { id: customer.id },
      select: { _count: { select: { builds: true, wishlist: true, orders: true } } },
    }),
  ]);
  if (!profile) redirect(`/${locale}/sign-in`);

  // The first visit sets the preferred language to the one in use. Later,
  // signing in lands on the account page in the preferred language.
  if (!profile.locale) {
    await db.user.update({
      where: { id: profile.id },
      data: { locale: locale === "fr" ? "fr" : "en" },
    });
  } else if (params.welcome && profile.locale !== locale) {
    redirect(`/${profile.locale}/account`);
  }
  const count = counts?._count ?? { builds: 0, wishlist: 0, orders: 0 };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">{t("signedInAs", { email: profile.email })}</p>
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <Button size="sm" variant="outline">
            {t("signOut")}
          </Button>
        </form>
      </section>

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/account/orders", Icon: Package, label: t("tabs.orders"), n: count.orders },
          { href: "/account/builds", Icon: Monitor, label: t("tabs.builds"), n: count.builds },
          { href: "/account/wishlist", Icon: Heart, label: t("tabs.wishlist"), n: count.wishlist },
        ].map(({ href, Icon, label, n }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-lg border bg-surface p-4 hover:border-accent/60"
            >
              <Icon aria-hidden="true" className="size-5 text-accent" />
              <span className="font-medium">{label}</span>
              <span className="ml-auto text-muted tabular-nums">{n}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("recentOrders")}</h2>
        <OrderList orders={orders} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("profile")}</h2>
        <ProfileForm
          locale={locale}
          name={profile.name ?? ""}
          preferredLocale={profile.locale ?? locale}
        />
      </section>
    </div>
  );
}
