"use server";

import { refresh, updateTag } from "next/cache";

import { parseDollars } from "@/lib/money";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";
import { SETTINGS_TAG, settingsSchema } from "@/server/settings";

export type SettingsState = { error?: string; saved?: boolean };

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function saveStoreSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const cashMaxCents = parseDollars(str(formData, "cashMax"));
  const parsed = settingsSchema.safeParse({
    etransferEmail: str(formData, "etransferEmail"),
    cashMaxCents,
    cardHoldMinutes: Number(str(formData, "cardHoldMinutes")),
    etransferHoldHours: Number(str(formData, "etransferHoldHours")),
    cashHoldDays: Number(str(formData, "cashHoldDays")),
    depositPercent: Number(str(formData, "depositPercent")),
    gstNumber: str(formData, "gstNumber"),
    qstNumber: str(formData, "qstNumber"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `Check “${String(issue.path[0])}”: ${issue.message}` };
  }
  await db.$transaction(
    Object.entries(parsed.data).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
  updateTag(SETTINGS_TAG);
  refresh();
  return { saved: true };
}

export async function saveLocation(
  code: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const fee = parseDollars(str(formData, "deliveryFee") || "0");
  if (fee === null) return { error: "Delivery fee must be an amount like 25.00" };
  const prefixes = str(formData, "prefixes")
    .split(/[\s,]+/)
    .map((p) => p.toUpperCase())
    .filter(Boolean);
  if (prefixes.some((p) => !/^[A-Z](\d[A-Z]?)?$/.test(p))) {
    return { error: "Postal prefixes look like M, M5 or M5V, separated by commas." };
  }
  await db.location.update({
    where: { code: code as "TOR" | "MTL" },
    data: {
      address: { en: str(formData, "address_en"), fr: str(formData, "address_fr") },
      hours: { en: str(formData, "hours_en"), fr: str(formData, "hours_fr") },
      deliveryPostalPrefixes: prefixes,
      deliveryFeeCents: fee,
    },
  });
  refresh();
  return { saved: true };
}

// Percent text like "13" or "9.975" → thousandths of a percent.
const rate = (s: string) => {
  const n = Number(s.replace(",", ".") || "0");
  return Number.isFinite(n) && n >= 0 && n < 100 ? Math.round(n * 1000) : null;
};

export async function saveTaxRate(
  province: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const values = {
    gst: rate(str(formData, "gst")),
    pst: rate(str(formData, "pst")),
    hst: rate(str(formData, "hst")),
    qst: rate(str(formData, "qst")),
  };
  if (Object.values(values).some((v) => v === null))
    return { error: "Rates are percentages, e.g. 13 or 9.975" };
  await db.taxRate.update({
    where: { province },
    data: { ...(values as Record<string, number>), collect: formData.get("collect") === "on" },
  });
  refresh();
  return { saved: true };
}
