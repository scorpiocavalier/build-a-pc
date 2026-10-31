import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountFallback, AccountShell } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { listAddresses } from "@/server/account/addresses";
import { requireCustomer } from "@/server/customer";
import { formatAddress } from "@/server/orders/view";

import { defaultAddressAction, deleteAddressAction } from "../actions";

import { AddressForm } from "./address-form";

type Props = PageProps<"/[locale]/account/addresses">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("tabs.addresses"), robots: { index: false } };
}

export default function AddressesPage({ searchParams }: Props) {
  return (
    <AccountShell current="addresses">
      <Suspense fallback={<AccountFallback />}>
        <Addresses searchParams={searchParams} />
      </Suspense>
    </AccountShell>
  );
}

async function Addresses({ searchParams }: Pick<Props, "searchParams">) {
  const locale = await getLocale();
  const customer = await requireCustomer(locale, `/${locale}/account/addresses`);
  const [params, addresses, t] = await Promise.all([
    searchParams,
    listAddresses(customer.id),
    getTranslations("Account"),
  ]);
  const editing = addresses.find((a) => a.id === params.edit);

  return (
    <div className="flex flex-col gap-8">
      {addresses.length === 0 ? (
        <p className="rounded-lg border bg-surface p-6 text-muted">{t("noAddresses")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col gap-2 rounded-lg border bg-surface p-4">
              <p className="flex items-center gap-2 font-medium">
                {address.name}
                {address.isDefault && (
                  <span className="rounded-full border border-accent/40 px-2 py-0.5 text-xs text-accent">
                    {t("default")}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted">{formatAddress(address)}</p>
              <p className="text-sm text-muted">{address.phone}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/account/addresses?edit=${address.id}`}>{t("edit")}</Link>
                </Button>
                {!address.isDefault && (
                  <form action={defaultAddressAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={address.id} />
                    <Button size="sm" variant="ghost">
                      {t("makeDefaultShort")}
                    </Button>
                  </form>
                )}
                <form action={deleteAddressAction} className="ml-auto">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={address.id} />
                  <Button size="sm" variant="ghost" className="text-red-300">
                    {t("delete")}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4 rounded-lg border bg-surface p-5">
        <h2 className="text-lg font-semibold">{editing ? t("editAddress") : t("newAddress")}</h2>
        <p className="text-sm text-muted">{t("addressHint")}</p>
        <AddressForm
          key={editing?.id ?? "new"}
          locale={locale}
          initial={
            editing
              ? { ...editing, isDefault: editing.isDefault }
              : { isDefault: addresses.length === 0 }
          }
        />
        {editing && (
          <Link href="/account/addresses" className="text-sm text-muted hover:text-foreground">
            {t("cancelEdit")}
          </Link>
        )}
      </section>
    </div>
  );
}
