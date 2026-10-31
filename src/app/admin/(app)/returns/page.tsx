import Link from "next/link";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listReturns } from "@/server/returns";
import { requireAdmin } from "@/server/require-admin";

import { DecisionForm } from "./decision-form";

export const metadata = { title: "Returns" };
export const instant = false;

const REASONS: Record<string, string> = {
  DEFECTIVE: "Defective",
  WRONG_ITEM: "Wrong item",
  NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed mind",
  OTHER: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: "border-amber-400/50 text-amber-300",
  APPROVED: "border-emerald-400/50 text-emerald-300",
  DECLINED: "border-red-400/50 text-red-300",
  COMPLETED: "text-muted",
};

export default async function AdminReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  await requireAdmin();
  const { show } = await searchParams;
  const all = show === "all";
  const requests = await listReturns(all ? "all" : "open");
  const date = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Returns</h1>
          <p className="mt-1 max-w-3xl text-muted">
            Customers ask for returns from their order page within 30 days of handover. Approve or
            decline here; the customer is emailed either way. Receiving items and refunds are done
            by hand for now.
          </p>
        </div>
        <nav className="flex gap-1 text-sm">
          <Link
            href="/admin/returns"
            className={cn("rounded-lg px-3 py-1.5", !all ? "bg-surface-raised" : "text-muted")}
          >
            To review
          </Link>
          <Link
            href="/admin/returns?show=all"
            className={cn("rounded-lg px-3 py-1.5", all ? "bg-surface-raised" : "text-muted")}
          >
            All
          </Link>
        </nav>
      </div>

      {requests.length === 0 && (
        <p className="rounded-lg border bg-surface/60 p-6 text-muted">
          {all ? "No return requests yet." : "Nothing to review."}
        </p>
      )}

      {requests.map((request) => (
        <section
          key={request.id}
          aria-label={`RMA-${request.number}`}
          className="flex flex-col gap-3 rounded-lg border bg-surface/60 p-5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-semibold">RMA-{request.number}</h2>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                STATUS_STYLE[request.status],
              )}
            >
              {request.status.toLowerCase()}
            </span>
            <Link
              href={`/admin/orders/${request.order.id}`}
              className="text-sm text-accent hover:underline"
            >
              {formatOrderNumber(request.order.number)}
            </Link>
            <span className="text-sm text-muted">{date.format(request.createdAt)}</span>
          </div>
          <p className="text-sm">
            {request.order.name} · {request.order.email} ·{" "}
            <span className="font-medium">{REASONS[request.reason]}</span>
            {request.feeCents > 0 && (
              <span className="text-muted">
                {" "}
                · restocking fee up to {formatMoney(request.feeCents, "en")}
              </span>
            )}
          </p>
          <ul className="text-sm">
            {request.lines.map((line) => (
              <li key={line.id}>
                {line.quantity} × {localize(line.orderLine.name, "en")}
                {line.orderLine.buildGroup && (
                  <span className="text-muted"> (assembled PC part)</span>
                )}
              </li>
            ))}
          </ul>
          <blockquote className="border-l-2 pl-3 text-sm whitespace-pre-line text-muted">
            {request.details}
          </blockquote>
          {request.status === "REQUESTED" ? (
            <DecisionForm id={request.id} />
          ) : (
            request.adminNote && <p className="text-sm">Our message: {request.adminNote}</p>
          )}
        </section>
      ))}
    </div>
  );
}
