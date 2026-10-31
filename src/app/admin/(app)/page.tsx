import Link from "next/link";

import { getOrderCounts } from "@/server/admin/orders";
import { getAdminDashboard } from "@/server/admin/products";
import { requireAdmin } from "@/server/require-admin";

export const metadata = { title: "Dashboard" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

export default async function AdminHomePage() {
  const [user, stats, orders] = await Promise.all([
    requireAdmin(),
    getAdminDashboard(),
    getOrderCounts(),
  ]);

  const orderCards = [
    {
      label: "Awaiting payment or confirmation",
      value: orders.placed,
      href: "/admin/orders?status=PLACED",
    },
    { label: "To prepare", value: orders.toPrepare, href: "/admin/orders?status=CONFIRMED" },
    { label: "Ready / out for delivery", value: orders.ready, href: "/admin/orders?status=READY" },
  ];

  const cards = [
    { label: "Active products", value: stats.active, href: "/admin/products?status=ACTIVE" },
    { label: "Drafts", value: stats.drafts, href: "/admin/products?status=DRAFT" },
    { label: "Missing French", value: stats.missingFrench, href: "/admin/products?missing=fr" },
    {
      label: "Out of stock everywhere",
      value: stats.outOfStock,
      href: "/admin/products?stock=out",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name ?? user.email}</h1>
        <p className="text-muted">Here&apos;s what needs attention.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {orderCards.map((card) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className="flex flex-col gap-1 rounded-lg border bg-surface p-5 hover:border-accent/60"
            >
              <span className="text-3xl font-semibold">{card.value}</span>
              <span className="text-sm text-muted">{card.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className="flex flex-col gap-1 rounded-lg border bg-surface p-5 hover:border-accent/60"
            >
              <span className="text-3xl font-semibold">{card.value}</span>
              <span className="text-sm text-muted">{card.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
