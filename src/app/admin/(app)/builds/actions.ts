"use server";

import { refresh } from "next/cache";

import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";

import type { SettingsState } from "../settings/actions";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Accepts a full share link (…/build/s/<id>) or just the id.
function shareIdFrom(input: string): string {
  const match = /\/build\/s\/([\w-]+)/.exec(input);
  return (match ? match[1] : input).trim();
}

function details(formData: FormData) {
  return {
    title: { en: str(formData, "title_en"), fr: str(formData, "title_fr") },
    description: { en: str(formData, "description_en"), fr: str(formData, "description_fr") },
    position: Number(str(formData, "position")) || 0,
  };
}

export async function featureBuildAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const shareId = shareIdFrom(str(formData, "share"));
  const data = details(formData);
  if (!data.title.en) return { error: "Give the build an English name." };
  const build = await db.build.findUnique({
    where: { shareId },
    include: { _count: { select: { items: true } } },
  });
  if (!build) return { error: "No build found for that link." };
  if (build._count.items === 0) return { error: "That build has no parts yet." };
  await db.build.update({ where: { id: build.id }, data: { ...data, featured: true } });
  refresh();
  return { saved: true };
}

export async function updateFeaturedAction(
  buildId: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const data = details(formData);
  if (!data.title.en) return { error: "Give the build an English name." };
  await db.build.update({ where: { id: buildId }, data });
  refresh();
  return { saved: true };
}

export async function unfeatureAction(buildId: string) {
  await requireAdmin();
  await db.build.update({ where: { id: buildId }, data: { featured: false } });
  refresh();
}
