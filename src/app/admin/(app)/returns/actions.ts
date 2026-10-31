"use server";

import { refresh } from "next/cache";

import { audit } from "@/server/audit";
import type { PaymentMethod, ReturnCondition } from "@/generated/prisma/enums";
import { parseDollars } from "@/lib/money";
import { completeReturn, decideReturn } from "@/server/returns";
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
  await audit({
    actorId: user.id,
    action: `return.${decision.toLowerCase()}`,
    entity: "return",
    entityId: id,
    summary: `${decision === "APPROVED" ? "Approved" : "Declined"} return${note ? `: ${note}` : ""}`,
  });
  refresh();
  return { saved: true };
}

export async function receiveReturnAction(
  id: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAdmin();
  const conditions: Record<string, ReturnCondition> = {};
  for (const [key, value] of formData) {
    if (key.startsWith("condition_") && (value === "RESTOCK" || value === "WRITE_OFF")) {
      conditions[key.slice("condition_".length)] = value;
    }
  }
  const feeCents = parseDollars(String(formData.get("fee") ?? "") || "0");
  if (feeCents === null) return { error: "Enter the restocking fee as an amount, e.g. 30.00" };
  const method = String(formData.get("method")) as PaymentMethod;
  if (!["CARD", "ETRANSFER", "CASH"].includes(method)) return { error: "Choose how to refund." };

  try {
    const result = await completeReturn(id, { conditions, feeCents, method, actorId: user.id });
    if (!result.ok) return { error: result.error };
  } catch (error) {
    console.error("[admin] return refund failed", error);
    return { error: "The card refund failed. Check Stripe, then try again." };
  }
  refresh();
  return { saved: true };
}
