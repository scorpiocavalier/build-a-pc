import { getLocale } from "next-intl/server";

import { siteUrl } from "@/lib/site-url";

import { JsonLd } from "./json-ld";

// The business, for search results. The store's address isn't published on
// the site, so there's no LocalBusiness entry.
export async function HomeStructuredData() {
  const locale = await getLocale();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Astral Tech Gaming",
        url: `${siteUrl()}/${locale}`,
      }}
    />
  );
}
