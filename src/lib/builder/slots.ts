import type { BuildSlot } from "@/generated/prisma/enums";

// The builder's slots, in the order customers fill them (docs/PLAN.md §7).
export const SLOTS: BuildSlot[] = [
  "CPU",
  "MOTHERBOARD",
  "MEMORY",
  "STORAGE",
  "STORAGE_2",
  "GPU",
  "CASE",
  "PSU",
  "COOLER",
];

export const SLOT_CATEGORY: Record<BuildSlot, string> = {
  CPU: "cpu",
  MOTHERBOARD: "motherboard",
  MEMORY: "memory",
  STORAGE: "storage",
  STORAGE_2: "storage",
  GPU: "gpu",
  CASE: "case",
  PSU: "psu",
  COOLER: "cooler",
};

// Memory kits and drives can be doubled up; everything else is one per build.
export const SLOT_MAX_QUANTITY: Record<BuildSlot, number> = {
  CPU: 1,
  MOTHERBOARD: 1,
  MEMORY: 2,
  STORAGE: 2,
  STORAGE_2: 2,
  GPU: 1,
  CASE: 1,
  PSU: 1,
  COOLER: 1,
};

// URL segments: /build/cpu, /build/storage-2 …
export function slotToParam(slot: BuildSlot): string {
  return slot.toLowerCase().replace("_", "-");
}

export function slotFromParam(param: string): BuildSlot | null {
  const slot = param.toUpperCase().replace("-", "_") as BuildSlot;
  return SLOTS.includes(slot) ? slot : null;
}
