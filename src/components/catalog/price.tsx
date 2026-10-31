import { useLocale, useTranslations } from "next-intl";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  cents,
  compareAtCents,
  className,
}: {
  cents: number;
  compareAtCents?: number | null;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Catalog");

  return (
    <span className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="font-semibold">{formatMoney(cents, locale)}</span>
      {compareAtCents ? (
        <span className="text-sm text-muted line-through">
          {t("wasPrice", { price: formatMoney(compareAtCents, locale) })}
        </span>
      ) : null}
    </span>
  );
}
