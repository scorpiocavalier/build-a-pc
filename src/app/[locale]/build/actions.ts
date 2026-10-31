"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import type { LocationCode } from "@/generated/prisma/enums";
import { slotFromParam } from "@/lib/builder/slots";
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
  if (location === "TOR" || location === "MTL") await setBuildLocation(location);
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
