"use server";

import { refresh } from "next/cache";

import { audit } from "@/server/audit";
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
  const user = await requireAdmin();
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
  await audit({
    actorId: user.id,
    action: "build.feature",
    entity: "build",
    entityId: build.id,
    summary: `Featured "${data.title.en}" on Prebuilt PCs`,
  });
  refresh();
  return { saved: true };
}

export async function updateFeaturedAction(
  buildId: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAdmin();
  const data = details(formData);
  if (!data.title.en) return { error: "Give the build an English name." };
  await db.build.update({ where: { id: buildId }, data });
  await audit({
    actorId: user.id,
    action: "build.update",
    entity: "build",
    entityId: buildId,
    summary: `Edited prebuilt "${data.title.en}"`,
  });
  refresh();
  return { saved: true };
}

export async function unfeatureAction(buildId: string) {
  const user = await requireAdmin();
  await db.build.update({ where: { id: buildId }, data: { featured: false } });
  await audit({
    actorId: user.id,
    action: "build.unfeature",
    entity: "build",
    entityId: buildId,
    summary: "Removed a build from Prebuilt PCs",
  });
  refresh();
}
