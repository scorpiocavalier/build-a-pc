import Link from "next/link";
import { notFound } from "next/navigation";

import { SLOTS } from "@/lib/builder/slots";
import { formatOrderNumber } from "@/lib/checkout/order-number";
import { formatDate } from "@/lib/checkout/windows";
import { getAdminOrder } from "@/server/admin/orders";

import { PrintButton } from "./print-button";

export const metadata = { title: "Build sheet" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

const SLOT_NAMES: Record<string, string> = {
  CPU: "Processor",
  MOTHERBOARD: "Motherboard",
  MEMORY: "Memory",
  STORAGE: "Storage",
  STORAGE_2: "Second drive",
  GPU: "Graphics card",
  CASE: "Case",
  PSU: "Power supply",
  COOLER: "CPU cooler",
};

const CHECKLIST = [
  "Parts match this sheet; serial numbers noted on the order",
  "BIOS updated to the latest stable version",
  "Memory runs at its rated speed (EXPO/XMP enabled)",
  "Windows installed, updated and activated",
  "Chipset and graphics drivers installed",
  "Stress test passed (CPU and GPU, 15 minutes); temperatures normal",
  "Fans and lighting configured; cables tidy",
  "Photos taken for the customer",
];

// A printable sheet for whoever assembles the order's PCs.
export default async function BuildSheetPage({
  params,
}: PageProps<"/admin/orders/[id]/build-sheet">) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order || order.assemblyCents === 0) notFound();

  const groups = [...new Set(order.lines.flatMap((l) => (l.buildGroup ? [l.buildGroup] : [])))];

  return (
    <div className="flex flex-col gap-6 print:text-black">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <Link
          href={`/admin/orders/${order.id}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to order
        </Link>
        <PrintButton />
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Build sheet · {formatOrderNumber(order.number)}</h1>
        <p className="text-sm text-muted print:text-black">
          {order.name} · {order.phone} · {order.fulfilment === "PICKUP" ? "Pickup" : "Delivery"} ·{" "}
          {order.location.name.en} · requested {formatDate(order.requestedWindow.date, "en")} (
          {order.requestedWindow.slot})
        </p>
        {order.notes && (
          <p className="mt-2 text-sm whitespace-pre-line">Customer notes: {order.notes}</p>
        )}
      </header>

      {groups.map((group, n) => {
        const lines = order.lines
          .filter((l) => l.buildGroup === group)
          .sort(
            (a, b) => (a.slot ? SLOTS.indexOf(a.slot) : 99) - (b.slot ? SLOTS.indexOf(b.slot) : 99),
          );
        return (
          <section
            key={group}
            className="flex break-inside-avoid flex-col gap-4 rounded-lg border p-5"
          >
            <h2 className="text-lg font-semibold">
              PC {n + 1} of {groups.length}
            </h2>
            <table className="w-full text-sm">
              <thead className="text-left text-muted print:text-black">
                <tr>
                  <th className="py-1 pr-3 font-medium">Slot</th>
                  <th className="py-1 pr-3 font-medium">Part</th>
                  <th className="py-1 pr-3 font-medium">SKU</th>
                  <th className="py-1 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1.5 pr-3">
                      {line.slot ? SLOT_NAMES[line.slot] : "Software"}
                    </td>
                    <td className="py-1.5 pr-3">{line.name.en}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{line.sku}</td>
                    <td className="py-1.5">{line.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="flex flex-col gap-2 text-sm">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-block size-4 shrink-0 rounded border"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-6 pt-4 text-sm">
              <p className="border-t pt-1">Built by</p>
              <p className="border-t pt-1">Date</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
