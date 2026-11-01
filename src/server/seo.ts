import "server-only";

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Canonical URL and hreflang links for a page that exists in both languages.
// `path` is the part after the locale, e.g. "/p/amd-ryzen-7-9800x3d" or "".
export async function localeAlternates(path: string): Promise<Metadata["alternates"]> {
  const locale = await getLocale();
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [`${l}-CA`, `/${l}${path}`])),
      "x-default": `/${routing.defaultLocale}${path}`,
    },
  };
}
