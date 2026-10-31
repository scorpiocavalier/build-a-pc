import "server-only";

import type { ReturnReason } from "@/generated/prisma/enums";
import {
  estimateRestockingFee,
  validateReturn,
  type ReturnError,
  type ReturnLineInput,
} from "@/lib/returns/eligibility";
import { db } from "@/server/db";
import { sendReturnEmail, notifyAdminsOfReturn } from "@/server/email/return-emails";

// Return requests (RMAs). Customers ask from their order page; staff approve
// or decline. Receiving, refunding and restocking come in Phase 5.

const requestInclude = {
  lines: { include: { orderLine: true } },
  order: {
    select: { id: true, number: true, name: true, email: true, locale: true, accessToken: true },
  },
} as const;

export async function loadOrderForReturn(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      lines: { orderBy: { id: "asc" } },
      returns: { include: { lines: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type ReturnRequestInput = {
  reason: ReturnReason;
  details: string;
  lines: ReturnLineInput[];
};

export async function createReturnRequest(
  orderId: string,
  input: ReturnRequestInput,
  userId: string | null,
): Promise<{ ok: true; number: number } | { ok: false; error: ReturnError }> {
  const result = await db.$transaction(async (tx) => {
    // Lock the order so two requests sent at once can't claim the same items.
    await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true, returns: { include: { lines: true } } },
    });
    if (!order) return { ok: false as const, error: "notEligible" as const };
    const checked = validateReturn(order, input, new Date());
    if (!checked.ok) return checked;

    const request = await tx.returnRequest.create({
      data: {
        orderId,
        userId,
        reason: input.reason,
        details: input.details,
        lines: { create: checked.lines },
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "return:requested",
        message: `RMA-${request.number}`,
        actorId: userId,
      },
    });
    return { ok: true as const, id: request.id, number: request.number };
  });
  if (!result.ok) return result;

  const request = await loadReturn(result.id);
  if (request) {
    await sendReturnEmail(request, "requested");
    await notifyAdminsOfReturn(request);
  }
  return { ok: true, number: result.number };
}

export async function loadReturn(id: string) {
  const request = await db.returnRequest.findUnique({ where: { id }, include: requestInclude });
  if (!request) return null;
  const order = await db.order.findUniqueOrThrow({
    where: { id: request.orderId },
    select: { lines: true },
  });
  return {
    ...request,
    feeCents: estimateRestockingFee(order, { reason: request.reason, lines: request.lines }),
  };
}

export type ReturnView = NonNullable<Awaited<ReturnType<typeof loadReturn>>>;

export async function listReturns(status?: "open" | "all") {
  const requests = await db.returnRequest.findMany({
    where: status === "all" ? {} : { status: "REQUESTED" },
    orderBy: { createdAt: status === "all" ? "desc" : "asc" },
    include: {
      ...requestInclude,
      order: { select: { ...requestInclude.order.select, lines: true } },
    },
    take: 200,
  });
  return requests.map(({ order: { lines, ...order }, ...request }) => ({
    ...request,
    order,
    feeCents: estimateRestockingFee({ lines }, { reason: request.reason, lines: request.lines }),
  }));
}

export async function decideReturn(
  id: string,
  decision: "APPROVED" | "DECLINED",
  note: string,
  actorId: string,
): Promise<{ ok: boolean }> {
  const { count } = await db.returnRequest.updateMany({
    where: { id, status: "REQUESTED" },
    data: {
      status: decision,
      adminNote: note || null,
      decidedAt: new Date(),
      decidedById: actorId,
    },
  });
  if (!count) return { ok: false };
  const request = (await loadReturn(id))!;
  await db.orderEvent.create({
    data: {
      orderId: request.orderId,
      type: `return:${decision.toLowerCase()}`,
      message: `RMA-${request.number}${note ? `: ${note}` : ""}`,
      actorId,
    },
  });
  await sendReturnEmail(request, decision === "APPROVED" ? "approved" : "declined");
  return { ok: true };
}
