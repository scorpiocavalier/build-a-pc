import { Field, Select } from "@/components/ui/field";
import {
  DEFAULT_LOCATION,
  LOCATION_CODES,
  LOCATION_NAMES,
  SINGLE_STORE,
  type LocationCode,
} from "@/lib/store-config";

// <option>s for this deployment's stores.
export function LocationOptions() {
  return LOCATION_CODES.map((code) => (
    <option key={code} value={code}>
      {LOCATION_NAMES[code]}
    </option>
  ));
}

// A store picker for a form, or a hidden field on a one-store deployment.
export function LocationField({
  id,
  name = "location",
  label = "Location",
  defaultValue = DEFAULT_LOCATION,
  className,
}: {
  id: string;
  name?: string;
  label?: string;
  defaultValue?: LocationCode;
  className?: string;
}) {
  if (SINGLE_STORE) return <input type="hidden" name={name} value={DEFAULT_LOCATION} />;
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Select id={id} name={name} defaultValue={defaultValue}>
        <LocationOptions />
      </Select>
    </Field>
  );
}
