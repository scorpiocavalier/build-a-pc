import Link from "next/link";

import { formatOrderNumber } from "@/lib/checkout/order-number";
import { localize } from "@/lib/localized";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listReturns, type ReturnListFilter } from "@/server/returns";
import { requireAdmin } from "@/server/require-admin";
import { stripeEnabled } from "@/server/settings";

import { DecisionForm } from "./decision-form";
import { ReceiveForm } from "./receive-form";

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
  const filter: ReturnListFilter = show === "all" || show === "approved" ? show : "open";
  const requests = await listReturns(filter);
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
            Customers ask for returns from their order page after handover. Approve or decline the
            request; once the items are back, inspect them, choose what goes back in stock, and
            refund. The customer is emailed at each step.
          </p>
        </div>
        <nav className="flex gap-1 text-sm">
          {(
            [
              ["open", "/admin/returns", "To review"],
              ["approved", "/admin/returns?show=approved", "Waiting for items"],
              ["all", "/admin/returns?show=all", "All"],
            ] as const
          ).map(([key, href, label]) => (
            <Link
              key={key}
              href={href}
              aria-current={filter === key ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5",
                filter === key ? "bg-surface-raised" : "text-muted",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {requests.length === 0 && (
        <p className="rounded-lg border bg-surface/60 p-6 text-muted">
          {filter === "all"
            ? "No return requests yet."
            : filter === "approved"
              ? "No approved returns waiting for items."
              : "Nothing to review."}
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
            {request.feeCents > 0 && request.status !== "COMPLETED" && (
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
          {request.adminNote && request.status !== "REQUESTED" && (
            <p className="text-sm">Our message: {request.adminNote}</p>
          )}
          {request.status === "REQUESTED" && <DecisionForm id={request.id} />}
          {request.status === "APPROVED" && (
            <ReceiveForm
              id={request.id}
              order={request.order}
              lines={request.lines.map((line) => ({
                id: line.id,
                orderLineId: line.orderLineId,
                quantity: line.quantity,
                name: localize(line.orderLine.name, "en"),
                defaultCondition: request.reason === "DEFECTIVE" ? "WRITE_OFF" : "RESTOCK",
              }))}
              defaultFeeCents={request.feeCents}
              refundableCents={request.order.paidCents - request.order.refundedCents}
              cardRefund={request.order.paidByCard && stripeEnabled()}
            />
          )}
          {request.status === "COMPLETED" && (
            <p className="text-sm text-emerald-300">
              Received {request.receivedAt ? date.format(request.receivedAt) : ""} · refunded{" "}
              {formatMoney(request.refundCents ?? 0, "en")}
              {request.refunds[0] ? ` by ${request.refunds[0].method.toLowerCase()}` : ""}
              {request.restockingFeeCents
                ? ` · fee ${formatMoney(request.restockingFeeCents, "en")}`
                : ""}
              {" · "}
              {request.lines
                .map(
                  (l) => `${l.quantity} ${l.condition === "RESTOCK" ? "restocked" : "written off"}`,
                )
                .join(", ")}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
