import type { BuildSlot } from "@/generated/prisma/enums";
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
  // Free stock.
  available: number;
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
  available: number;
  errors: Issue[];
};

export type BuilderData = {
  parts: Partial<Record<BuildSlot, PartView>>;
  issues: Issue[];
  missing: BuildSlot[];
};
