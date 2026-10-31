"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { computeReturnRefund, type OrderForRefund } from "@/lib/returns/refund";
import { formatMoney } from "@/lib/money";

import type { SettingsState } from "../settings/actions";

import { receiveReturnAction } from "./actions";

export type ReceiveLine = {
  id: string;
  orderLineId: string;
  name: string;
  quantity: number;
  defaultCondition: "RESTOCK" | "WRITE_OFF";
};

export function ReceiveForm({
  id,
  lines,
  order,
  defaultFeeCents,
  refundableCents,
  cardRefund,
}: {
  id: string;
  lines: ReceiveLine[];
  order: OrderForRefund;
  defaultFeeCents: number;
  refundableCents: number;
  // The order was paid by card and Stripe is set up.
  cardRefund: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    receiveReturnAction.bind(null, id),
    {},
  );
  const [fee, setFee] = useState((defaultFeeCents / 100).toFixed(2));
  const feeCents = Math.round((Number(fee.replace(",", ".")) || 0) * 100);
  const preview = computeReturnRefund(order, lines, feeCents);
  const money = (cents: number) => formatMoney(cents, "en");

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border bg-background/40 p-4">
      <h3 className="font-medium">Receive and refund</h3>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label htmlFor={`condition-${line.id}`}>
              {line.quantity} × {line.name}
            </label>
            <Select
              id={`condition-${line.id}`}
              name={`condition_${line.id}`}
              defaultValue={line.defaultCondition}
              className="w-56"
            >
              <option value="RESTOCK">Back in stock</option>
              <option value="WRITE_OFF">Defective: don&apos;t restock</option>
            </Select>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Restocking fee ($)"
          htmlFor={`fee-${id}`}
          hint="Pre-filled from the reason; set to 0 if the item turns out to be faulty."
        >
          <Input
            id={`fee-${id}`}
            name="fee"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Refund by" htmlFor={`method-${id}`}>
          <Select
            id={`method-${id}`}
            name="method"
            defaultValue={cardRefund ? "CARD" : "ETRANSFER"}
          >
            {cardRefund && <option value="CARD">Card (refund through Stripe now)</option>}
            <option value="ETRANSFER">e-Transfer (already sent)</option>
            <option value="CASH">Cash (already given)</option>
          </Select>
        </Field>
      </div>
      <dl className="grid max-w-sm grid-cols-2 gap-x-4 text-sm">
        <dt className="text-muted">Items</dt>
        <dd className="text-right tabular-nums">{money(preview.itemsCents)}</dd>
        <dt className="text-muted">Tax on items</dt>
        <dd className="text-right tabular-nums">{money(preview.taxCents)}</dd>
        <dt className="text-muted">Restocking fee</dt>
        <dd className="text-right tabular-nums">−{money(preview.feeCents)}</dd>
        <dt className="font-semibold">Refund</dt>
        <dd className="text-right font-semibold tabular-nums" data-testid="refund-total">
          {money(preview.refundCents)}
        </dd>
      </dl>
      {preview.refundCents > refundableCents && (
        <p className="text-sm text-amber-300">
          Only {money(refundableCents)} paid on this order is left to refund.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={pending}>
          {pending ? "Refunding…" : `Receive items and refund ${money(preview.refundCents)}`}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-red-300">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
