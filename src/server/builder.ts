import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import type { BuildSlot, LocationCode, Prisma } from "@/generated/prisma/client";
import {
  candidateErrors,
  checkBuild,
  estimateWattage,
  missingForAssembly,
  type Issue,
  type ResolvedBuild,
} from "@/lib/builder/compat";
import { SLOT_CATEGORY, SLOT_MAX_QUANTITY, SLOTS } from "@/lib/builder/slots";
import { LOCATION_CODES } from "@/lib/catalog/product-input";
import type { LocalizedText } from "@/lib/localized";
import type { SpecValues } from "@/lib/specs/types";
import { getCategoryProducts, type ProductSummary } from "@/server/catalog/queries";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { publicUrl } from "@/server/storage";

// The PC builder's saved builds. Like the cart, the browser holds a secret
// token in an httpOnly cookie; anyone else sees a build only through its
// read-only share link.

export const BUILD_COOKIE = "atg_build";

const itemInclude = {
  product: {
    include: {
      brand: true,
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      inventory: { include: { location: true } },
    },
  },
} satisfies Prisma.BuildItemInclude;

type ItemRow = Prisma.BuildItemGetPayload<{ include: typeof itemInclude }>;

export type BuildItemView = {
  slot: BuildSlot;
  productId: string;
  slug: string;
  sku: string;
  name: LocalizedText;
  brand: string;
  categorySlug: string;
  specs: SpecValues;
  unitPriceCents: number;
  quantity: number;
  imageUrl: string | null;
  available: Record<LocationCode, number>;
  active: boolean;
};

export type BuildView = {
  id: string;
  shareId: string;
  location: LocationCode;
  featured: boolean;
  position: number;
  // Saved to a customer's account under this name.
  name: string | null;
  userId: string | null;
  updatedAt: Date;
  title: LocalizedText | null;
  description: LocalizedText | null;
  items: Partial<Record<BuildSlot, BuildItemView>>;
  issues: Issue[];
  missing: BuildSlot[];
  wattage: number;
  partsCents: number;
};

function toItem(row: ItemRow): BuildItemView {
  const available = Object.fromEntries(LOCATION_CODES.map((c) => [c, 0])) as Record<
    LocationCode,
    number
  >;
  for (const stock of row.product.inventory) {
    available[stock.location.code] = Math.max(0, stock.onHand - stock.reserved);
  }
  return {
    slot: row.slot,
    productId: row.productId,
    slug: row.product.slug,
    sku: row.product.sku,
    name: row.product.name as LocalizedText,
    brand: row.product.brand.name,
    categorySlug: row.product.category.slug,
    specs: row.product.specs as SpecValues,
    unitPriceCents: row.product.priceCents,
    quantity: row.quantity,
    imageUrl: row.product.images[0] ? publicUrl(row.product.images[0].key) : null,
    available,
    active: row.product.status === "ACTIVE",
  };
}

export function resolve(items: Partial<Record<BuildSlot, BuildItemView>>): ResolvedBuild {
  const build: ResolvedBuild = {};
  for (const item of Object.values(items)) {
    build[item.slot] = {
      productId: item.productId,
      name: item.name.en,
      specs: item.specs,
      quantity: item.quantity,
    };
  }
  return build;
}

type BuildRow = Prisma.BuildGetPayload<{ include: { items: { include: typeof itemInclude } } }>;

function toView(row: BuildRow): BuildView {
  const items: BuildView["items"] = {};
  // Parts that were archived since drop out of the build.
  for (const item of row.items.map(toItem).filter((i) => i.active)) items[item.slot] = item;
  const resolved = resolve(items);
  return {
    id: row.id,
    shareId: row.shareId,
    location: row.location,
    featured: row.featured,
    position: row.position,
    name: row.name,
    userId: row.userId,
    updatedAt: row.updatedAt,
    title: row.title as LocalizedText | null,
    description: row.description as LocalizedText | null,
    items,
    issues: checkBuild(resolved),
    missing: missingForAssembly(resolved),
    wattage: estimateWattage(resolved),
    partsCents: Object.values(items).reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
  };
}

async function loadBuild(where: Prisma.BuildWhereUniqueInput): Promise<BuildView | null> {
  const row = await db.build.findUnique({ where, include: { items: { include: itemInclude } } });
  return row ? toView(row) : null;
}

async function myToken() {
  return (await cookies()).get(BUILD_COOKIE)?.value;
}

export async function getMyBuild(): Promise<BuildView | null> {
  const token = await myToken();
  return token ? loadBuild({ editToken: token }) : null;
}

export async function getSharedBuild(shareId: string): Promise<BuildView | null> {
  return loadBuild({ shareId });
}

export async function listFeaturedBuilds(): Promise<BuildView[]> {
  const rows = await db.build.findMany({
    where: { featured: true },
    orderBy: { position: "asc" },
    include: { items: { include: itemInclude } },
  });
  return rows.map(toView);
}

async function ensureMyBuildId(): Promise<string> {
  const token = await myToken();
  if (token) {
    const build = await db.build.findUnique({ where: { editToken: token }, select: { id: true } });
    if (build) return build.id;
  }
  const editToken = randomBytes(24).toString("base64url");
  const build = await db.build.create({
    data: { editToken, shareId: randomBytes(6).toString("base64url").toLowerCase() },
  });
  await setBuildCookie(editToken);
  return build.id;
}

async function setBuildCookie(editToken: string) {
  (await cookies()).set(BUILD_COOKIE, editToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function setSlot(slot: BuildSlot, productId: string, quantity: number) {
  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE", category: { slug: SLOT_CATEGORY[slot] } },
    select: { id: true },
  });
  if (!product) return false;
  const buildId = await ensureMyBuildId();
  const qty = Math.max(1, Math.min(SLOT_MAX_QUANTITY[slot], quantity));
  await db.buildItem.upsert({
    where: { buildId_slot: { buildId, slot } },
    create: { buildId, slot, productId, quantity: qty },
    update: { productId, quantity: qty },
  });
  return true;
}

export async function clearSlot(slot: BuildSlot) {
  const token = await myToken();
  if (!token) return;
  await db.buildItem.deleteMany({ where: { slot, build: { editToken: token } } });
}

export async function clearBuild() {
  const token = await myToken();
  if (!token) return;
  const build = await db.build.findUnique({
    where: { editToken: token },
    select: { userId: true },
  });
  // A build saved to an account is kept; the browser starts a fresh one.
  if (build?.userId) await forgetMyBuild();
  else await db.buildItem.deleteMany({ where: { build: { editToken: token } } });
}

export async function forgetMyBuild() {
  (await cookies()).delete(BUILD_COOKIE);
}

// ─── Saved builds (customer accounts) ───────────────────────────────────────

// Saves the browser's current build to the customer's account. A build saved
// by someone else on this browser is copied rather than taken over.
export async function saveMyBuild(userId: string, name: string): Promise<boolean> {
  const token = await myToken();
  if (!token) return false;
  const build = await db.build.findUnique({
    where: { editToken: token },
    include: { items: true },
  });
  if (!build || build.items.length === 0) return false;
  if (!build.userId || build.userId === userId) {
    await db.build.update({ where: { id: build.id }, data: { userId, name } });
    return true;
  }
  const editToken = randomBytes(24).toString("base64url");
  await db.build.create({
    data: {
      editToken,
      shareId: randomBytes(6).toString("base64url").toLowerCase(),
      location: build.location,
      userId,
      name,
      items: {
        create: build.items.map(({ slot, productId, quantity }) => ({ slot, productId, quantity })),
      },
    },
  });
  await setBuildCookie(editToken);
  return true;
}

export async function listSavedBuilds(userId: string): Promise<BuildView[]> {
  const rows = await db.build.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { items: { include: itemInclude } },
  });
  return rows.map(toView);
}

// Makes a saved build the one the builder edits on this browser.
export async function openSavedBuild(userId: string, id: string): Promise<boolean> {
  const build = await db.build.findFirst({ where: { id, userId }, select: { editToken: true } });
  if (!build) return false;
  await setBuildCookie(build.editToken);
  return true;
}

export async function deleteSavedBuild(userId: string, id: string) {
  const build = await db.build.findFirst({
    where: { id, userId },
    select: { featured: true, editToken: true },
  });
  if (!build) return;
  // A build the store features on /prebuilt stays; it just leaves the account.
  if (build.featured) {
    await db.build.update({ where: { id }, data: { userId: null } });
  } else {
    await db.build.delete({ where: { id } });
  }
  if ((await myToken()) === build.editToken) await forgetMyBuild();
}

export async function setBuildLocation(location: LocationCode) {
  const buildId = await ensureMyBuildId();
  await db.build.update({ where: { id: buildId }, data: { location } });
}

// "Customize this build": copies a shared build into the visitor's own.
export async function copyIntoMyBuild(shareId: string) {
  const source = await db.build.findUnique({ where: { shareId }, include: { items: true } });
  if (!source) return false;
  const buildId = await ensureMyBuildId();
  await db.$transaction([
    db.buildItem.deleteMany({ where: { buildId } }),
    db.buildItem.createMany({
      data: source.items.map(({ slot, productId, quantity }) => ({
        buildId,
        slot,
        productId,
        quantity,
      })),
    }),
    db.build.update({ where: { id: buildId }, data: { location: source.location } }),
  ]);
  return true;
}

export type Candidate = ProductSummary & { errors: Issue[] };

// Parts for a slot, each checked against the rest of the build.
export async function listCandidates(slot: BuildSlot, build: BuildView | null) {
  const data = await getCategoryProducts(SLOT_CATEGORY[slot]);
  const resolved = build ? resolve(build.items) : {};
  // The part currently in this slot shouldn't count against its replacements.
  delete resolved[slot];
  const candidates: Candidate[] = (data?.products ?? []).map((product) => ({
    ...product,
    errors: candidateErrors(resolved, slot, {
      productId: product.id,
      name: product.name.en,
      specs: product.specs,
      quantity: 1,
    }),
  }));
  return { category: data?.category ?? null, candidates };
}

export { SLOTS };

export type AssemblyExtras = {
  feeCents: number;
  days: number;
  windows: { name: LocalizedText; priceCents: number } | null;
};

// What "Have us build it" adds on top of the parts.
export async function getAssemblyExtras(): Promise<AssemblyExtras> {
  const settings = await getSettings();
  const windows = await db.product.findFirst({
    where: { sku: settings.windowsSku, status: "ACTIVE" },
    select: { name: true, priceCents: true },
  });
  return {
    feeCents: settings.assemblyFeeCents,
    days: settings.assemblyDays,
    windows: windows
      ? { name: windows.name as LocalizedText, priceCents: windows.priceCents }
      : null,
  };
}
