import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { formatOrderNumber } from "@/lib/checkout/order-number";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listAdminOrders } from "@/server/admin/orders";

import { STATUS_STYLE } from "./status-style";

export const metadata = { title: "Orders" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const PAYMENT_STYLE: Record<string, string> = {
  UNPAID: "text-amber-300",
  PARTIALLY_PAID: "text-amber-300",
  PAID: "text-emerald-300",
  PARTIALLY_REFUNDED: "text-muted",
  REFUNDED: "text-muted",
};

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const filters = { status: one("status") || "open", q: one("q"), location: one("location") };
  const orders = await listAdminOrders(filters);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Order #, name, email, phone"
          aria-label="Search orders"
          className="w-64"
        />
        <Select name="status" defaultValue={filters.status} aria-label="Status" className="w-48">
          <option value="open">Open orders</option>
          <option value="PLACED">Placed (awaiting payment)</option>
          <option value="CONFIRMED">Confirmed (to prepare)</option>
          <option value="ASSEMBLING">Being assembled</option>
          <option value="READY">Ready</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="all">All</option>
        </Select>
        <Select
          name="location"
          defaultValue={filters.location}
          aria-label="Location"
          className="w-40"
        >
          <option value="">Both locations</option>
          <option value="TOR">Toronto</option>
          <option value="MTL">Montreal</option>
        </Select>
        <Button variant="outline">Filter</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Fulfilment</th>
              <th className="px-3 py-2 font-medium">Payment</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-surface/60">
                <td className="px-3 py-2">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-accent">
                    {formatOrderNumber(o.number)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {o.name}
                  <span className="block text-xs text-muted">{o.email}</span>
                </td>
                <td className="px-3 py-2">
                  {o.fulfilment === "PICKUP" ? "Pickup" : "Delivery"} · {o.location.code}
                </td>
                <td className={cn("px-3 py-2", PAYMENT_STYLE[o.paymentStatus])}>
                  {o.paymentMethod.toLowerCase()} ·{" "}
                  {o.paymentStatus.toLowerCase().replace("_", " ")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(o.totalCents, "en")}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      STATUS_STYLE[o.status],
                    )}
                  >
                    {o.status.toLowerCase().replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted">
                  {new Intl.DateTimeFormat("en-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Toronto",
                  }).format(o.placedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-6 text-center text-muted">No orders found.</p>}
      </div>
    </div>
  );
}
