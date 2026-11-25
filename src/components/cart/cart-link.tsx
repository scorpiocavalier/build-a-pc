import { ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { menuLink } from "@/components/nav-links";
import { Link } from "@/i18n/navigation";
import { getCartCount } from "@/server/cart";

const className =
  "relative rounded-lg p-1 text-muted hover:bg-surface-raised hover:text-foreground min-[360px]:p-1.5 min-[400px]:p-2";

// "header" is the icon in the header; "menu" is a labelled row in the mobile
// menu, whose accessible name starts with its visible text (WCAG 2.5.3).
type Variant = "header" | "menu";

function Badge({ count, variant }: { count: number; variant: Variant }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={
        variant === "menu"
          ? "ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground"
          : "absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
      }
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

// Reads the cart cookie, so it streams in behind a Suspense boundary.
export async function CartLink({ variant = "header" }: { variant?: Variant }) {
  const [count, t, tHeader] = await Promise.all([
    getCartCount(),
    getTranslations("Cart"),
    getTranslations("Header"),
  ]);
  return (
    <Link
      href="/cart"
      aria-label={t("cartLabel", { count })}
      className={variant === "menu" ? menuLink : className}
    >
      <ShoppingCart aria-hidden="true" className="size-5" />
      {variant === "menu" && <span>{tHeader("nav.cart")}</span>}
      <Badge count={count} variant={variant} />
    </Link>
  );
}

export async function CartLinkFallback({ variant = "header" }: { variant?: Variant }) {
  const t = await getTranslations("Header");
  return (
    <Link
      href="/cart"
      aria-label={t("nav.cart")}
      className={variant === "menu" ? menuLink : className}
    >
      <ShoppingCart aria-hidden="true" className="size-5" />
      {variant === "menu" && <span>{t("nav.cart")}</span>}
    </Link>
  );
}
