import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";

// Business settings editable in /admin/settings. Anything not saved yet uses
// the defaults below, which are placeholders until the owner decides.

export const SETTINGS_TAG = "settings";

export const settingsSchema = z.object({
  etransferEmail: z.email().or(z.literal("")),
  // Cash is offered only for totals below this (Bill C-2: keep under $10,000).
  cashMaxCents: z.number().int().min(0),
  cardHoldMinutes: z.number().int().min(30).max(1440),
  etransferHoldHours: z.number().int().min(1).max(336),
  cashHoldDays: z.number().int().min(1).max(30),
  depositPercent: z.number().int().min(0).max(100),
  // Flat fee per assembled PC, and the Windows licence included with it.
  assemblyFeeCents: z.number().int().min(0),
  windowsSku: z.string().min(1),
  // Shown as "Ready in about N business days" for assembled builds.
  assemblyDays: z.number().int().min(1).max(30),
  gstNumber: z.string(),
  qstNumber: z.string(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  etransferEmail: "",
  cashMaxCents: 1_000_000,
  // Stripe Checkout sessions can't expire sooner than 30 minutes.
  cardHoldMinutes: 30,
  etransferHoldHours: 48,
  cashHoldDays: 7,
  depositPercent: 30,
  assemblyFeeCents: 14_999,
  windowsSku: "WIN11-HOME",
  assemblyDays: 2,
  gstNumber: "",
  qstNumber: "",
};

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);

  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // Ignore stored values that no longer validate rather than breaking checkout.
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const parsed = settingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success) (merged as Record<string, unknown>)[key] = parsed.data;
  }
  return merged;
}

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}
