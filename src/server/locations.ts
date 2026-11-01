import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { LocalizedText } from "@/lib/localized";
import { db } from "@/server/db";

// The stores, for the locations page, structured data and the footer.
export const LOCATIONS_TAG = "locations";

export type StoreLocation = {
  code: "TOR" | "MTL";
  name: LocalizedText;
  address: LocalizedText;
  hours: LocalizedText;
  province: string;
  deliveryPostalPrefixes: string[];
  deliveryFeeCents: number;
};

export async function getLocations(): Promise<StoreLocation[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(LOCATIONS_TAG);
  const rows = await db.location.findMany({ where: { active: true }, orderBy: { code: "desc" } });
  return rows.map((row) => ({
    code: row.code,
    name: row.name as LocalizedText,
    address: row.address as LocalizedText,
    hours: row.hours as LocalizedText,
    province: row.province,
    deliveryPostalPrefixes: row.deliveryPostalPrefixes,
    deliveryFeeCents: row.deliveryFeeCents,
  }));
}
