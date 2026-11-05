"use server";

import { refresh, revalidateTag } from "next/cache";

import { parseDollars } from "@/lib/money";
import { receivePurchase, setAverageCost } from "@/server/admin/purchases";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { requireAdmin } from "@/server/require-admin";
import { locationOrDefault } from "@/lib/store-config";

export type PurchaseState = { error?: string; saved?: string };

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const location = locationOrDefault;
// Empty means zero for the optional fees; anything unreadable is rejected.
const optionalCents = (value: string) => (value ? (parseDollars(value) ?? NaN) : 0);

export async function purchaseAction(
  _prev: PurchaseState,
  formData: FormData,
): Promise<PurchaseState> {
  const user = await requireAdmin();
  const skus = formData.getAll("sku").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const costs = formData.getAll("unitCost").map(String);
  const lines = skus
    .map((sku, i) => ({
      sku: sku.trim(),
      quantity: quantities[i]?.trim() ?? "",
      unitCost: costs[i]?.trim() ?? "",
    }))
    // Rows left completely empty are ignored.
    .filter((l) => l.sku || l.quantity || l.unitCost)
    .map((l) => ({
      sku: l.sku,
      quantity: Number(l.quantity),
      unitCostCents: parseDollars(l.unitCost) ?? NaN,
    }));
  const date = str(formData, "purchasedAt");
  const result = await receivePurchase({
    location: location(str(formData, "location")),
    supplier: str(formData, "supplier").slice(0, 120),
    reference: str(formData, "reference").slice(0, 120),
    // Noon in Toronto, so the date reads the same in both time zones.
    purchasedAt: new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00-05:00` : "x"),
    shippingCents: optionalCents(str(formData, "shipping")),
    dutiesCents: optionalCents(str(formData, "duties")),
    otherCents: optionalCents(str(formData, "other")),
    split: str(formData, "split") === "UNITS" ? "UNITS" : "VALUE",
    note: str(formData, "note").slice(0, 200),
    lines,
    actorId: user.id,
  });
  if (!result.ok) return { error: result.error };
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return { saved: `Received as PO-${result.number}.` };
}

export async function setCostAction(
  _prev: { error?: string; saved?: boolean },
  formData: FormData,
): Promise<{ error?: string; saved?: boolean }> {
  const user = await requireAdmin();
  const result = await setAverageCost({
    sku: str(formData, "sku"),
    location: location(str(formData, "location")),
    costCents: parseDollars(str(formData, "cost")) ?? NaN,
    note: str(formData, "note").slice(0, 200),
    actorId: user.id,
  });
  if (!result.ok) return { error: result.error };
  refresh();
  return { saved: true };
}
