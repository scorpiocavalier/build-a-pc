import { ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getCartCount } from "@/server/cart";

const className =
  "relative rounded-lg p-1.5 text-muted hover:bg-surface-raised hover:text-foreground min-[400px]:p-2";

// Reads the cart cookie, so it streams in behind a Suspense boundary.
export async function CartLink() {
  const [count, t] = await Promise.all([getCartCount(), getTranslations("Cart")]);
  return (
    <Link href="/cart" aria-label={t("cartLabel", { count })} className={className}>
      <ShoppingCart aria-hidden="true" className="size-5" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

export async function CartLinkFallback() {
  const t = await getTranslations("Header");
  return (
    <Link href="/cart" aria-label={t("nav.cart")} className={className}>
      <ShoppingCart aria-hidden="true" className="size-5" />
    </Link>
  );
}
