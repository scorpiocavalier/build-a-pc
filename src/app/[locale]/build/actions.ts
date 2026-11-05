"use server";

import { isLocationCode } from "@/lib/store-config";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import type { LocationCode } from "@/generated/prisma/enums";
import type { CandidateView } from "@/components/builder3d/types";
import { slotFromParam } from "@/lib/builder/slots";
import { candidateViews } from "@/server/builder-3d";
import { addBuildToCart, addToCart } from "@/server/cart";
import {
  clearBuild,
  clearSlot,
  copyIntoMyBuild,
  getMyBuild,
  setBuildLocation,
  setSlot,
} from "@/server/builder";

const localeOf = (formData: FormData) => (formData.get("locale") === "fr" ? "fr" : "en");

export async function chooseAction(formData: FormData) {
  const slot = slotFromParam(String(formData.get("slot") ?? ""));
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1) || 1;
  if (slot) await setSlot(slot, productId, quantity);
  redirect(`/${localeOf(formData)}/build`);
}

export async function removeAction(formData: FormData) {
  const slot = slotFromParam(String(formData.get("slot") ?? ""));
  if (slot) await clearSlot(slot);
  refresh();
}

export async function clearAction() {
  await clearBuild();
  refresh();
}

export async function locationAction(formData: FormData) {
  const location = String(formData.get("location")) as LocationCode;
  if (isLocationCode(location)) await setBuildLocation(location);
  refresh();
}

export async function customizeAction(formData: FormData) {
  await copyIntoMyBuild(String(formData.get("shareId") ?? ""));
  redirect(`/${localeOf(formData)}/build`);
}

export type AddBuildState = { added?: "parts" | "assembled"; error?: "incompatible" | "empty" };

export async function addBuildAction(
  _prev: AddBuildState,
  formData: FormData,
): Promise<AddBuildState> {
  const mode = formData.get("mode") === "assembled" ? "assembled" : "parts";
  // Re-check on the server: the page may be stale, and the button could be forged.
  const build = await getMyBuild();
  const items = build ? Object.values(build.items) : [];
  if (!build || items.length === 0) return { error: "empty" };

  if (mode === "assembled") {
    const blocked = build.missing.length > 0 || build.issues.some((i) => i.severity === "error");
    if (blocked) return { error: "incompatible" };
    await addBuildToCart(
      items.map(({ slot, productId, quantity }) => ({ slot, productId, quantity })),
    );
  } else {
    for (const item of items) await addToCart(item.productId, item.quantity);
  }
  refresh();
  return { added: mode };
}

// ─── 3D builder ─────────────────────────────────────────────────────────────
// Same changes as the list builder, but they stay on the page (no redirect):
// the 3D view refreshes in place.

export async function candidatesAction(
  slotParam: string,
  locale: string,
): Promise<CandidateView[]> {
  const slot = slotFromParam(slotParam);
  if (!slot) return [];
  return candidateViews(slot, await getMyBuild(), locale === "fr" ? "fr" : "en");
}

export async function choosePartAction(
  slotParam: string,
  productId: string,
  quantity: number,
): Promise<{ ok: boolean }> {
  const slot = slotFromParam(slotParam);
  if (!slot) return { ok: false };
  const ok = await setSlot(slot, productId, Math.max(1, Math.floor(quantity) || 1));
  refresh();
  return { ok };
}

export async function removePartAction(slotParam: string): Promise<void> {
  const slot = slotFromParam(slotParam);
  if (slot) await clearSlot(slot);
  refresh();
}
