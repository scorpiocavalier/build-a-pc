import type { BuildSlot, LocationCode } from "@/generated/prisma/enums";
import type { Issue } from "@/lib/builder/compat";
import type { SpecValues } from "@/lib/specs/types";

// What the 3D builder gets from the server: plain, already-translated data.

export type PartView = {
  slot: BuildSlot;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  unitPriceCents: number;
  quantity: number;
  imageUrl: string | null;
  // Key specs, formatted for display ("AM5 · 8 cores").
  facts: string[];
  available: Record<LocationCode, number>;
  // Raw specs, for sizing the 3D model.
  specs: SpecValues;
};

export type CandidateView = {
  productId: string;
  name: string;
  brand: string;
  priceCents: number;
  imageUrl: string | null;
  facts: string[];
  available: Record<LocationCode, number>;
  errors: Issue[];
};

export type BuilderData = {
  location: LocationCode;
  parts: Partial<Record<BuildSlot, PartView>>;
  issues: Issue[];
  missing: BuildSlot[];
};
