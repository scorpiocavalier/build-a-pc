import { BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

// Every assembled or prebuilt PC comes with Windows 11 Pro installed, at no
// extra charge. Shown wherever such a PC and its price appear.
export async function WindowsIncluded({ className }: { className?: string }) {
  const t = await getTranslations("Cart");
  return (
    <p className={cn("flex items-center gap-1.5 text-sm text-muted", className)}>
      <BadgeCheck aria-hidden="true" className="size-4 shrink-0 text-accent" />
      {t("assembledIncludes")}
    </p>
  );
}
