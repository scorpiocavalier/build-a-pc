import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { JsonLd, storeJsonLd } from "@/components/seo/json-ld";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { getLocations } from "@/server/locations";
import { localeAlternates } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  return {
    title: t("locations.title"),
    description: t("locations.description"),
    alternates: await localeAlternates("/locations"),
  };
}

export default async function LocationsPage() {
  const [t, locale, locations] = await Promise.all([
    getTranslations("Legal"),
    getLocale(),
    getLocations(),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <JsonLd data={locations.map((l) => storeJsonLd(l, locale))} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("locations.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("locations.intro")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {locations.map((location) => (
          <li key={location.code} className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <MapPin aria-hidden="true" className="size-5 text-accent" />
              {localize(location.name, locale)}
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="font-medium">{t("locations.address")}</dt>
                <dd className="text-muted">{localize(location.address, locale)}</dd>
              </div>
              <div>
                <dt className="font-medium">{t("locations.hours")}</dt>
                <dd className="text-muted">{localize(location.hours, locale)}</dd>
              </div>
              <div>
                <dt className="font-medium">{t("locations.delivery")}</dt>
                <dd className="text-muted">
                  {location.deliveryPostalPrefixes.length
                    ? t("locations.deliveryAreas", {
                        prefixes: location.deliveryPostalPrefixes.join(", "),
                        fee: formatMoney(location.deliveryFeeCents, locale),
                      })
                    : t("locations.noDelivery")}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
