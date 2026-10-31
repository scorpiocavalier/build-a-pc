import type { CategoryDefinition, SpecField, SpecValue, SpecValues } from "./types";

// One parser for every way specs come in: admin form fields and CSV cells
// (strings) and stored JSON (typed values). Error messages are English
// because only admins see them.

export type SpecParseResult =
  { ok: true; values: SpecValues } | { ok: false; errors: Record<string, string> };

const TRUE = new Set(["true", "yes", "y", "1", "oui", "o"]);
const FALSE = new Set(["false", "no", "n", "0", "non"]);

function isBlank(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === "string") return raw.trim() === "";
  if (Array.isArray(raw)) return raw.every(isBlank);
  return false;
}

// CSV cells hold several values separated by "|"; form fields arrive as arrays.
function toList(raw: unknown): string[] {
  const items = Array.isArray(raw) ? raw : String(raw).split("|");
  return items.map((v) => String(v).trim()).filter(Boolean);
}

function parseField(field: SpecField, raw: unknown): { value: SpecValue } | { error: string } {
  switch (field.type) {
    case "enum": {
      const value = String(raw).trim();
      const match = field.options.find((o) => o.value.toLowerCase() === value.toLowerCase());
      return match
        ? { value: match.value }
        : { error: `must be one of: ${field.options.map((o) => o.value).join(", ")}` };
    }
    case "multiEnum": {
      const values: string[] = [];
      for (const item of toList(raw)) {
        const match = field.options.find((o) => o.value.toLowerCase() === item.toLowerCase());
        if (!match) {
          return {
            error: `"${item}" isn't allowed; use: ${field.options.map((o) => o.value).join(", ")}`,
          };
        }
        if (!values.includes(match.value)) values.push(match.value);
      }
      // Keep the definition's order so stored values are stable.
      const order = field.options.map((o) => o.value);
      return { value: values.sort((a, b) => order.indexOf(a) - order.indexOf(b)) };
    }
    case "int":
    case "decimal": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
      if (!Number.isFinite(n)) return { error: "must be a number" };
      if (field.type === "int" && !Number.isInteger(n)) return { error: "must be a whole number" };
      if (field.min !== undefined && n < field.min)
        return { error: `must be at least ${field.min}` };
      if (field.max !== undefined && n > field.max)
        return { error: `must be at most ${field.max}` };
      return { value: n };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { value: raw };
      const s = String(raw).trim().toLowerCase();
      if (TRUE.has(s)) return { value: true };
      if (FALSE.has(s)) return { value: false };
      return { error: "must be yes or no" };
    }
    case "text":
      return { value: String(raw).trim() };
  }
}

export function parseSpecs(
  definition: CategoryDefinition,
  input: Record<string, unknown>,
): SpecParseResult {
  const values: SpecValues = {};
  const errors: Record<string, string> = {};

  for (const field of definition.fields) {
    const raw = input[field.key];
    if (isBlank(raw)) continue;
    const result = parseField(field, raw);
    if ("error" in result) errors[field.key] = `${field.label.en} ${result.error}`;
    else values[field.key] = result.value;
  }

  for (const field of definition.fields) {
    if (field.key in values || field.key in errors) continue;
    const when = field.requiredWhen;
    if (field.required || (when && values[when.key] === when.equals)) {
      errors[field.key] = `${field.label.en} is required`;
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}
