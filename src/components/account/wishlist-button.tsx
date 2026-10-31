import { Heart } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { toggleWishlistAction } from "@/app/[locale]/account/actions";
import { Button } from "@/components/ui/button";
import { isWishlisted } from "@/server/account/wishlist";
import { getCustomer } from "@/server/customer";

// Reads the session, so it streams in behind a Suspense boundary.
export async function WishlistButton({ productId, path }: { productId: string; path: string }) {
  const [customer, locale, t] = await Promise.all([
    getCustomer(),
    getLocale(),
    getTranslations("Account"),
  ]);
  const back = `/${locale}${path}`;

  if (!customer) {
    return (
      <Button asChild variant="ghost" size="sm" className="self-start">
        <a href={`/${locale}/sign-in?next=${encodeURIComponent(back)}`}>
          <Heart aria-hidden="true" className="size-4" />
          {t("addToWishlist")}
        </a>
      </Button>
    );
  }

  const saved = await isWishlisted(customer.id, productId);
  return (
    <form action={toggleWishlistAction} className="self-start">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="back" value={back} />
      <Button variant="ghost" size="sm" aria-pressed={saved}>
        <Heart aria-hidden="true" className={saved ? "size-4 fill-accent text-accent" : "size-4"} />
        {saved ? t("inWishlist") : t("addToWishlist")}
      </Button>
    </form>
  );
}

export function WishlistButtonFallback() {
  return <div aria-hidden="true" className="h-9 w-40" />;
}
