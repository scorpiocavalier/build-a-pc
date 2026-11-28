import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// One-line availability for product cards: in stock or not.
export function StockSummary({ available, className }: { available: number; className?: string }) {
  const t = useTranslations("Catalog");
  const inStock = available > 0;

  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", inStock ? "bg-emerald-400" : "bg-muted/50")}
      />
      <span className={inStock ? "text-foreground" : "text-muted"}>
        {inStock ? t("inStock") : t("outOfStock")}
      </span>
    </p>
  );
}
