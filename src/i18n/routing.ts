import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  // The Montreal store's site opens in French (Quebec's Charter of the French
  // Language); Toronto and the combined site open in English.
  defaultLocale: process.env.NEXT_PUBLIC_STORE_LOCATION === "MTL" ? "fr" : "en",
});

export type AppLocale = (typeof routing.locales)[number];
