import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountFallback, AccountShell } from "@/components/account/account-shell";
import { OrderList } from "@/components/account/order-list";
import { listMyOrders } from "@/server/account/orders";
import { requireCustomer } from "@/server/customer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("tabs.orders"), robots: { index: false } };
}

export default function AccountOrdersPage() {
  return (
    <AccountShell current="orders">
      <Suspense fallback={<AccountFallback />}>
        <Orders />
      </Suspense>
    </AccountShell>
  );
}

async function Orders() {
  const locale = await getLocale();
  const customer = await requireCustomer(locale, `/${locale}/account/orders`);
  const [orders, t] = await Promise.all([listMyOrders(customer.id), getTranslations("Account")]);
  return (
    <div className="flex flex-col gap-3">
      <OrderList orders={orders} />
      <p className="text-sm text-muted">{t("ordersNote")}</p>
    </div>
  );
}
