import { X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

import { removeAction } from "@/app/[locale]/build/actions";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { SLOT_CATEGORY, SLOTS, slotToParam } from "@/lib/builder/slots";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { BuildView } from "@/server/builder";

const OPTIONAL = new Set(["STORAGE_2", "GPU", "COOLER"]);

// The builder's slots. Editable on /build; read-only on shared builds.
export async function SlotList({
  build,
  editable,
}: {
  build: BuildView | null;
  editable: boolean;
}) {
  const [t, catalog, locale] = await Promise.all([
    getTranslations("Builder"),
    getTranslations("Catalog"),
    getLocale(),
  ]);
  const location = build?.location ?? "TOR";
  const locationName = catalog(`locations.${location}`);
  const errorSlots = new Set(
    (build?.issues ?? []).filter((i) => i.severity === "error").flatMap((i) => i.slots),
  );
  const slots = editable ? SLOTS : SLOTS.filter((slot) => build?.items[slot]);

  return (
    <ol className="flex flex-col divide-y rounded-lg border bg-surface">
      {slots.map((slot) => {
        const item = build?.items[slot];
        const label = t(`slots.${slot}`);
        return (
          <li
            key={slot}
            className={cn(
              "flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap",
              errorSlots.has(slot) && "bg-red-400/5",
            )}
          >
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-raised">
              {item?.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <CategoryIcon slug={SLOT_CATEGORY[slot]} className="size-6 text-muted" />
              )}
            </div>
            {/* Phones: name on the first line, price and buttons below it. */}
            <div className="min-w-0 flex-1 max-sm:basis-[calc(100%-3.75rem)]">
              <p className="text-xs tracking-wide text-muted uppercase">
                {label}
                {editable && OPTIONAL.has(slot) && !item && ` · ${t("optional")}`}
              </p>
              {item ? (
                <>
                  <Link href={`/p/${item.slug}`} className="font-medium hover:text-accent">
                    {item.quantity > 1 && `${item.quantity} × `}
                    {item.brand} {localize(item.name, locale)}
                  </Link>
                  <p
                    className={cn(
                      "text-xs",
                      item.available[location] >= item.quantity ? "text-muted" : "text-amber-300",
                    )}
                  >
                    {item.available[location] >= item.quantity
                      ? t("inStockHere", { location: locationName })
                      : t("notHere", { location: locationName })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </div>
            {item && (
              <p className="font-semibold tabular-nums max-sm:ml-[3.75rem]">
                {formatMoney(item.unitPriceCents * item.quantity, locale)}
              </p>
            )}
            {editable && (
              <div className="ml-auto flex items-center gap-1">
                <Button asChild size="sm" variant={item ? "outline" : "primary"}>
                  <Link
                    href={`/build/${slotToParam(slot)}`}
                    aria-label={`${item ? t("change") : t("choose")}: ${label}`}
                  >
                    {item ? t("change") : t("choose")}
                  </Link>
                </Button>
                {item && (
                  <form action={removeAction}>
                    <input type="hidden" name="slot" value={slotToParam(slot)} />
                    <Button size="sm" variant="ghost" aria-label={`${t("remove")}: ${label}`}>
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </form>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
