import type { LocationCode } from "@/generated/prisma/enums";

// The site runs one store, Toronto. The database keeps its Location table
// and LocationCode enum (other codes are history from when the site ran two
// stores); the server uses this code to find the store's row. Never show or
// count other rows.
export const DEFAULT_LOCATION: LocationCode = "TOR";
