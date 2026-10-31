"use server";

import { refresh } from "next/cache";

import { decideReturn } from "@/server/returns";
import { requireAdmin } from "@/server/require-admin";

import type { SettingsState } from "../settings/actions";

export async function decideReturnAction(
  id: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAdmin();
  const decision = formData.get("decision") === "APPROVED" ? "APPROVED" : "DECLINED";
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 1000);
  if (decision === "DECLINED" && !note) {
    return { error: "Tell the customer why when declining." };
  }
  const result = await decideReturn(id, decision, note, user.id);
  if (!result.ok) return { error: "This request was already decided." };
  refresh();
  return { saved: true };
}
