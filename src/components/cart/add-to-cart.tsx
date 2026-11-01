"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { addToCartAction, type AddToCartState } from "@/app/[locale]/cart/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function AddToCart({ productId, maxQuantity }: { productId: string; maxQuantity: number }) {
  const t = useTranslations("Cart");
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCartAction, {});
  const options = Array.from({ length: Math.max(1, Math.min(10, maxQuantity)) }, (_, i) => i + 1);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          {t("quantity")}
          <select
            name="quantity"
            defaultValue="1"
            className="h-11 w-20 rounded-lg border bg-surface px-2 text-foreground"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={pending} className="flex-1 sm:flex-none">
          <ShoppingCart aria-hidden="true" className="size-4" />
          {pending ? t("adding") : t("addToCart")}
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm">
        {state.added ? (
          <span className="flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-4 text-emerald-400" />
            {t("added", { count: state.added })}{" "}
            <Link href="/cart" className="text-accent underline underline-offset-2">
              {t("viewCart")}
            </Link>
          </span>
        ) : null}
      </p>
    </form>
  );
}
