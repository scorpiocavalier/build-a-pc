import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

// The admin audit log (/admin/audit). Every admin server action records what
// it changed. Failures to write the log never block the change itself.

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: "product" | "order" | "return" | "inventory" | "settings" | "build" | "import";
  entityId?: string | null;
  summary: string;
  details?: Prisma.InputJsonValue;
};

export async function audit(entry: AuditEntry, tx: Prisma.TransactionClient = db) {
  try {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 500),
        details: entry.details,
      },
    });
  } catch (error) {
    // Inside a transaction, a failed insert aborts it, so let that surface.
    if (tx !== db) throw error;
    console.error("[audit] could not record", entry.action, error);
  }
}

export async function listAudit(filters: { entity?: string; q?: string; take?: number }) {
  return db.auditLog.findMany({
    where: {
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.q
        ? {
            OR: [
              { summary: { contains: filters.q, mode: "insensitive" } },
              { entityId: filters.q },
              { actor: { email: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 200,
    include: { actor: { select: { email: true, name: true } } },
  });
}
