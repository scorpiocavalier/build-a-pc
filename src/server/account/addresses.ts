import "server-only";

import type { AddressInput } from "@/lib/account/address-input";
import { db } from "@/server/db";

// Saved delivery addresses. Every query is scoped to the owner, so one
// customer can never read or change another's addresses.

export async function listAddresses(userId: string) {
  return db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export type SavedAddress = Awaited<ReturnType<typeof listAddresses>>[number];

const MAX_ADDRESSES = 10;

export async function saveAddress(userId: string, input: AddressInput, id?: string) {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (!id && count >= MAX_ADDRESSES) return { ok: false as const, error: "limit" as const };
    // The first address is the default one.
    const isDefault = input.isDefault || count === 0;
    if (isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    if (id) {
      const { count: updated } = await tx.address.updateMany({
        where: { id, userId },
        data: { ...input, isDefault },
      });
      if (!updated) return { ok: false as const, error: "notFound" as const };
    } else {
      await tx.address.create({ data: { ...input, isDefault, userId } });
    }
    return { ok: true as const };
  });
}

export async function deleteAddress(userId: string, id: string) {
  await db.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id, userId } });
    if (!address) return;
    await tx.address.delete({ where: { id } });
    if (address.isDefault) {
      // Promote the oldest remaining address.
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

export async function setDefaultAddress(userId: string, id: string) {
  await db.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id, userId }, select: { id: true } });
    if (!address) return;
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.address.update({ where: { id }, data: { isDefault: true } });
  });
}
