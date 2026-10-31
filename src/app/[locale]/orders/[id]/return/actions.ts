"use server";

import { redirect } from "next/navigation";

import type { ReturnReason } from "@/generated/prisma/enums";
import { RETURN_REASONS, type ReturnError } from "@/lib/returns/eligibility";
import { getCustomer } from "@/server/customer";
import { db } from "@/server/db";
import { createReturnRequest } from "@/server/returns";

export type ReturnFormState = {
  error?: ReturnError | "reason" | "details";
  values?: Record<string, string>;
};

export async function requestReturnAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData)
    if (typeof value === "string" && !key.startsWith("$")) raw[key] = value;
  const locale = raw.locale === "fr" ? "fr" : "en";

  // The same secret as the order page: guests have it in their link.
  const order = await db.order.findUnique({
    where: { id: raw.orderId ?? "" },
    select: { id: true, accessToken: true },
  });
  if (!order || order.accessToken !== raw.token) return { error: "notEligible", values: raw };

  const reason = raw.reason as ReturnReason;
  if (!(RETURN_REASONS as readonly string[]).includes(reason))
    return { error: "reason", values: raw };
  const details = (raw.details ?? "").trim();
  if (details.length < 10) return { error: "details", values: raw };

  const lines = Object.entries(raw)
    .filter(([key]) => key.startsWith("qty_"))
    .map(([key, value]) => ({ orderLineId: key.slice(4), quantity: Number(value) || 0 }));

  const customer = await getCustomer();
  const result = await createReturnRequest(
    order.id,
    { reason, details: details.slice(0, 2000), lines },
    customer?.id ?? null,
  );
  if (!result.ok) return { error: result.error, values: raw };
  redirect(`/${locale}/orders/${order.id}?t=${order.accessToken}&rma=${result.number}`);
}
