import type { LocalizedText } from "@/lib/localized";

export type SpecOption = {
  value: string;
  // Only needed when the value itself isn't language-neutral (e.g. colours).
  label?: LocalizedText;
};

type BaseField = {
  key: string;
  label: LocalizedText;
  // Required fields are the ones the compatibility rules depend on.
  required?: boolean;
  // Required only when another field has a given value.
  requiredWhen?: { key: string; equals: string };
  // Show as a filter on the category page.
  filter?: boolean;
};

export type SpecField =
  | (BaseField & { type: "enum"; options: SpecOption[] })
  | (BaseField & { type: "multiEnum"; options: SpecOption[] })
  | (BaseField & { type: "int"; unit?: string; min?: number; max?: number })
  | (BaseField & { type: "decimal"; unit?: string; min?: number; max?: number })
  | (BaseField & { type: "boolean" })
  | (BaseField & { type: "text" });

export type SpecValue = string | number | boolean | string[];
export type SpecValues = Record<string, SpecValue>;

export type CategoryDefinition = {
  slug: string;
  name: LocalizedText;
  fields: SpecField[];
};
