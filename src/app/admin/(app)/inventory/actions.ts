"use server";

import { revalidateTag } from "next/cache";
import { refresh } from "next/cache";

import { adjustStock } from "@/server/admin/inventory";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { requireAdmin } from "@/server/require-admin";

import type { SettingsState } from "../settings/actions";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function adjustAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAdmin();
  const result = await adjustStock({
    sku: str(formData, "sku"),
    delta: Number(str(formData, "delta")),
    reason: str(formData, "reason") === "WRITE_OFF" ? "WRITE_OFF" : "ADJUSTMENT",
    note: str(formData, "note").slice(0, 200),
    actorId: user.id,
  });
  if (!result.ok) return { error: result.error };
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return { saved: true };
}
