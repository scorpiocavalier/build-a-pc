import { localize } from "@/lib/localized";

import type { SpecField, SpecValue } from "./types";

const YES_NO = { en: ["Yes", "No"], fr: ["Oui", "Non"] } as const;

// French abbreviates bytes as "o" (octet).
const FRENCH_UNITS: Record<string, string> = { GB: "Go", TB: "To", "MB/s": "Mo/s" };

function unitFor(field: SpecField, locale: string): string {
  if (!("unit" in field) || !field.unit) return "";
  return locale === "fr" ? (FRENCH_UNITS[field.unit] ?? field.unit) : field.unit;
}

export function formatOption(field: SpecField, value: string, locale: string): string {
  if (field.type !== "enum" && field.type !== "multiEnum") return value;
  const option = field.options.find((o) => o.value === value);
  return option?.label ? localize(option.label, locale) : value;
}

export function formatSpecValue(field: SpecField, value: SpecValue, locale: string): string {
  if (Array.isArray(value)) return value.map((v) => formatOption(field, v, locale)).join(", ");
  if (typeof value === "boolean") {
    const [yes, no] = YES_NO[locale === "fr" ? "fr" : "en"];
    return value ? yes : no;
  }
  if (typeof value === "number") {
    const unit = unitFor(field, locale) && `\u00a0${unitFor(field, locale)}`;
    return `${new Intl.NumberFormat(`${locale}-CA`).format(value)}${unit}`;
  }
  return formatOption(field, value, locale);
}
