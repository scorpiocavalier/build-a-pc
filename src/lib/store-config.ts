// Which store this deployment runs. Toronto and Montreal are separate
// businesses, each with its own deployment, database, domain, Stripe account
// and admins, all from this one codebase. Set NEXT_PUBLIC_STORE_LOCATION to
// "TOR" or "MTL" per deployment; left unset (development, tests), the site
// runs both stores together.
//
// Code that lists stores should iterate LOCATION_CODES, never hard-code both.

export const ALL_LOCATION_CODES = ["TOR", "MTL"] as const;
export type LocationCode = (typeof ALL_LOCATION_CODES)[number];

export function parseStoreSetting(value: string | undefined): readonly LocationCode[] {
  return value === "TOR" || value === "MTL" ? [value] : ALL_LOCATION_CODES;
}

// NEXT_PUBLIC_ so it's also inlined into browser code at build time.
export const LOCATION_CODES = parseStoreSetting(process.env.NEXT_PUBLIC_STORE_LOCATION);

// True on a one-store deployment: hide store pickers and transfers.
export const SINGLE_STORE = LOCATION_CODES.length === 1;

// The store used when none is chosen (e.g. a new PC build).
export const DEFAULT_LOCATION: LocationCode = LOCATION_CODES[0];

export const LOCATION_NAMES: Record<LocationCode, string> = { TOR: "Toronto", MTL: "Montreal" };

export function isLocationCode(value: unknown): value is LocationCode {
  return (LOCATION_CODES as readonly unknown[]).includes(value);
}

// A posted store code, or this deployment's default when it's not one of ours.
export function locationOrDefault(value: unknown): LocationCode {
  return isLocationCode(value) ? value : DEFAULT_LOCATION;
}

// A store filter from the URL for admin lists and reports. A one-store
// deployment always filters to its own store (its database may still hold
// the other store's history from before the split).
export function storeFilter(value: unknown): LocationCode | null {
  if (SINGLE_STORE) return DEFAULT_LOCATION;
  return isLocationCode(value) ? value : null;
}
