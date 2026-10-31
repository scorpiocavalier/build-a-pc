import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountFallback, AccountShell } from "@/components/account/account-shell";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localized";
import { listWishlist } from "@/server/account/wishlist";
import { requireCustomer } from "@/server/customer";

import { removeWishlistAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("tabs.wishlist"), robots: { index: false } };
}

export default function WishlistPage() {
  return (
    <AccountShell current="wishlist">
      <Suspense fallback={<AccountFallback />}>
        <Wishlist />
      </Suspense>
    </AccountShell>
  );
}

async function Wishlist() {
  const locale = await getLocale();
  const customer = await requireCustomer(locale, `/${locale}/account/wishlist`);
  const [products, t] = await Promise.all([listWishlist(customer.id), getTranslations("Account")]);
  if (products.length === 0) {
    return (
      <p className="rounded-lg border bg-surface p-6 text-muted">
        {t("noWishlist")}{" "}
        <Link href="/shop" className="text-accent hover:underline">
          {t("startShopping")}
        </Link>
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {products.map((product) => (
        <li key={product.id} className="flex flex-col gap-2">
          <ProductCard product={product} />
          <form action={removeWishlistAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="productId" value={product.id} />
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              aria-label={`${t("removeFromWishlist")}: ${localize(product.name, locale)}`}
            >
              {t("removeFromWishlist")}
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
