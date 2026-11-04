import { Select } from "@/components/ui/field";
import type { Facet } from "@/lib/catalog/filters";
import type { LocalizedText } from "@/lib/localized";
import { formatOption, formatSpecValue } from "@/lib/specs/format";

const optionLabel = (facet: Facet, value: string) => {
  const field = facet.field!;
  if (field.type === "boolean") return formatSpecValue(field, value === "true", "en");
  if (field.type === "int" || field.type === "decimal") {
    return formatSpecValue(field, Number(value), "en");
  }
  return formatOption(field, value, "en");
};

// One dropdown per spec of the chosen part, with how many products match.
export function SpecSelects({ facets }: { facets: Facet[] }) {
  return facets.map((facet) => {
    const label = (facet.field!.label as LocalizedText).en;
    return (
      <Select
        key={facet.key}
        name={`spec.${facet.key}`}
        defaultValue={facet.options.find((o) => o.selected)?.value ?? ""}
        aria-label={label}
        className="w-44"
      >
        <option value="">Any {label.toLowerCase()}</option>
        {facet.options.map((o) => (
          <option key={o.value} value={o.value}>
            {optionLabel(facet, o.value)} ({o.count})
          </option>
        ))}
      </Select>
    );
  });
}
