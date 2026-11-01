import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { TaxLine } from "@/lib/checkout/pricing";
import type { RequestedWindow } from "@/lib/checkout/windows";
import type { LocalizedText } from "@/lib/localized";
import { db } from "@/server/db";
import { siteUrl } from "@/lib/site-url";

// One shape for an order, used by the customer's order page, emails and the
// admin dashboard.

const orderInclude = {
  location: true,
  lines: { orderBy: { id: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
  events: { orderBy: { createdAt: "asc" } },
  returns: { include: { lines: true }, orderBy: { createdAt: "asc" } },
  refunds: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type DeliveryAddress = {
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
};

export type OrderView = Omit<
  OrderRow,
  "deliveryAddress" | "requestedWindow" | "taxBreakdown" | "lines" | "location"
> & {
  deliveryAddress: DeliveryAddress | null;
  requestedWindow: RequestedWindow;
  taxBreakdown: TaxLine[];
  lines: (Omit<OrderRow["lines"][number], "name"> & { name: LocalizedText })[];
  location: Omit<OrderRow["location"], "name" | "address" | "hours"> & {
    name: LocalizedText;
    address: LocalizedText;
    hours: LocalizedText;
  };
};

function toView(row: OrderRow): OrderView {
  return {
    ...row,
    deliveryAddress: row.deliveryAddress as DeliveryAddress | null,
    requestedWindow: row.requestedWindow as RequestedWindow,
    taxBreakdown: row.taxBreakdown as TaxLine[],
    lines: row.lines.map((line) => ({ ...line, name: line.name as LocalizedText })),
    location: {
      ...row.location,
      name: row.location.name as LocalizedText,
      address: row.location.address as LocalizedText,
      hours: row.location.hours as LocalizedText,
    },
  };
}

export async function loadOrder(id: string): Promise<OrderView | null> {
  const row = await db.order.findUnique({ where: { id }, include: orderInclude });
  return row ? toView(row) : null;
}

// For the customer's order page: needs the secret token from their link.
export async function loadOrderForCustomer(id: string, token: string): Promise<OrderView | null> {
  const order = await loadOrder(id);
  return order && order.accessToken === token ? order : null;
}

export function orderUrl(order: Pick<OrderView, "id" | "accessToken" | "locale">): string {
  const base = siteUrl();
  return `${base}/${order.locale}/orders/${order.id}?t=${order.accessToken}`;
}

export function formatAddress(address: DeliveryAddress): string {
  return [address.line1, address.line2, address.city, `${address.province} ${address.postalCode}`]
    .filter(Boolean)
    .join(", ");
}
