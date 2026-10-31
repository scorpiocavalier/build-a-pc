import { useTranslations } from "next-intl";

import { LOCATION_CODES } from "@/lib/catalog/product-input";
import { cn } from "@/lib/utils";
import type { Availability } from "@/server/catalog/queries";

// One-line availability for product cards: where it's in stock, or not.
export function StockSummary({
  available,
  className,
}: {
  available: Availability;
  className?: string;
}) {
  const t = useTranslations("Catalog");
  const inStock = LOCATION_CODES.filter((code) => available[code] > 0);

  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", inStock.length ? "bg-emerald-400" : "bg-muted/50")}
      />
      <span className={inStock.length ? "text-foreground" : "text-muted"}>
        {inStock.length
          ? t("inStockAt", { locations: inStock.map((code) => t(`locations.${code}`)).join(", ") })
          : t("outOfStock")}
      </span>
    </p>
  );
}
