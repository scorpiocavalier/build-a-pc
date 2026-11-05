import { locationOrDefault } from "@/lib/store-config";
import "server-only";

import type { BuildSlot } from "@/generated/prisma/enums";
import type { BuilderData, CandidateView, PartView } from "@/components/builder3d/types";
import { SLOT_CATEGORY } from "@/lib/builder/slots";
import { localize } from "@/lib/localized";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { formatSpecValue } from "@/lib/specs/format";
import type { SpecValues } from "@/lib/specs/types";
import { listCandidates, type BuildView } from "@/server/builder";

// Turns builder data into the plain, translated shape the 3D view uses.

function facts(slot: BuildSlot, specs: SpecValues, locale: string): string[] {
  const definition = getCategoryDefinition(SLOT_CATEGORY[slot]);
  return (definition?.fields ?? [])
    .filter((f) => f.filter && specs[f.key] !== undefined)
    .slice(0, 4)
    .map((f) => formatSpecValue(f, specs[f.key], locale));
}

export function builderData(build: BuildView | null, locale: string): BuilderData {
  const parts: BuilderData["parts"] = {};
  for (const item of Object.values(build?.items ?? {})) {
    const view: PartView = {
      slot: item.slot,
      productId: item.productId,
      slug: item.slug,
      name: localize(item.name, locale),
      brand: item.brand,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      facts: facts(item.slot, item.specs, locale),
      available: item.available,
      specs: item.specs,
    };
    parts[item.slot] = view;
  }
  return {
    location: locationOrDefault(build?.location),
    parts,
    issues: build?.issues ?? [],
    missing: build?.missing ?? [],
  };
}

export async function candidateViews(
  slot: BuildSlot,
  build: BuildView | null,
  locale: string,
): Promise<CandidateView[]> {
  const { candidates } = await listCandidates(slot, build);
  return candidates.map((c) => ({
    productId: c.id,
    name: localize(c.name, locale),
    brand: c.brand,
    priceCents: c.priceCents,
    imageUrl: c.image?.url ?? null,
    facts: facts(slot, c.specs, locale),
    available: c.available,
    errors: c.errors,
  }));
}
