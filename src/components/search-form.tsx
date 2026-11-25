import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// Product search, posting to the search page. Used in the header and the
// mobile menu, so each copy gets its own input id.
export function SearchForm({
  id,
  className,
  inputClassName,
}: {
  id: string;
  className?: string;
  inputClassName?: string;
}) {
  const t = useTranslations("Header");
  const locale = useLocale();

  return (
    <form action={`/${locale}/search`} role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {t("searchLabel")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      />
      <input
        id={id}
        name="q"
        type="search"
        placeholder={t("searchPlaceholder")}
        className={cn("h-9 w-full rounded-lg border bg-surface pr-3 pl-9 text-sm", inputClassName)}
      />
    </form>
  );
}
