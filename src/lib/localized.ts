import { z } from "zod";

// Customer-facing text stored in the database, in both site languages.
export type LocalizedText = { en: string; fr: string };
export type SiteLocale = keyof LocalizedText;

export const localizedTextSchema = z.object({
  en: z.string().trim().min(1, "English text is required"),
  // French may be filled in after English; the site falls back to English.
  fr: z.string().trim(),
});

export function localize(text: unknown, locale: string): string {
  const value = text as Partial<LocalizedText> | null | undefined;
  if (!value) return "";
  return (locale === "fr" && value.fr) || value.en || "";
}

export function isMissingFrench(text: unknown): boolean {
  const value = text as Partial<LocalizedText> | null | undefined;
  return !!value?.en && !value.fr;
}
