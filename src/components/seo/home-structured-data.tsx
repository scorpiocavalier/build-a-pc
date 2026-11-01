import { getLocale } from "next-intl/server";

import { getLocations } from "@/server/locations";
import { siteUrl } from "@/lib/site-url";

import { JsonLd, storeJsonLd } from "./json-ld";

// The business and both stores, for search results and maps.
export async function HomeStructuredData() {
  const [locale, locations] = await Promise.all([getLocale(), getLocations()]);
  const base = siteUrl();
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Astral Tech Gaming",
          url: `${base}/${locale}`,
          department: locations.map((l) => ({ "@id": `${base}/#store-${l.code}` })),
        },
        ...locations.map((l) => storeJsonLd(l, locale)),
      ]}
    />
  );
}
