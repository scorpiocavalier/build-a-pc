import { localize } from "@/lib/localized";
import type { StoreLocation } from "@/server/locations";
import { siteUrl } from "@/lib/site-url";

// schema.org structured data, so search engines can show prices, stock and
// store details.

const base = () => siteUrl();

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // "<" is escaped so text from the database can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function storeJsonLd(location: StoreLocation, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ComputerStore",
    "@id": `${base()}/#store-${location.code}`,
    name: `Astral Tech Gaming ${localize(location.name, locale)}`,
    url: `${base()}/${locale}/locations`,
    address: {
      "@type": "PostalAddress",
      streetAddress: localize(location.address, locale),
      addressRegion: location.province,
      addressCountry: "CA",
    },
    currenciesAccepted: "CAD",
    paymentAccepted: "Credit card, Interac e-Transfer, Cash",
  };
}
