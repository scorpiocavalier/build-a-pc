"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

import {
  cancelOrderAction,
  changeStatusAction,
  recordPaymentAction,
  type ActionState,
} from "./actions";

const LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm order",
  ASSEMBLING: "Start assembly",
  READY: "Mark ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Mark completed (handed over)",
};

function Message({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-red-300">
        {state.error}
      </p>
    );
  }
  return null;
}

export function StatusButton({
  orderId,
  to,
}: {
  orderId: string;
  to: Exclude<OrderStatus, "CANCELLED">;
}) {
  const [state, action, pending] = useActionState<ActionState>(
    changeStatusAction.bind(null, orderId, to),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button disabled={pending} variant={to === "COMPLETED" ? "primary" : "outline"}>
        {LABELS[to]}
      </Button>
      <Message state={state} />
    </form>
  );
}

export function RecordPaymentForm({
  orderId,
  owingDollars,
  defaultMethod,
}: {
  orderId: string;
  owingDollars: string;
  defaultMethod: PaymentMethod;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPaymentAction.bind(null, orderId),
    {},
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[10rem_8rem_1fr_auto] sm:items-end">
      <Field label="Method" htmlFor="pay-method">
        <Select
          id="pay-method"
          name="method"
          defaultValue={defaultMethod === "CARD" ? "ETRANSFER" : defaultMethod}
        >
          <option value="ETRANSFER">e-Transfer</option>
          <option value="CASH">Cash</option>
        </Select>
      </Field>
      <Field label="Amount ($)" htmlFor="pay-amount">
        <Input id="pay-amount" name="amount" defaultValue={owingDollars} inputMode="decimal" />
      </Field>
      <Field label="Reference (optional)" htmlFor="pay-ref">
        <Input id="pay-ref" name="reference" placeholder="e-Transfer reference or note" />
      </Field>
      <Button disabled={pending}>Record payment</Button>
      <div className="sm:col-span-4">
        <Message state={state} />
      </div>
    </form>
  );
}

export function CancelOrderForm({ orderId, willRefund }: { orderId: string; willRefund: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    cancelOrderAction.bind(null, orderId),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="Reason (sent to the customer)"
        htmlFor="cancel-reason"
        hint={
          willRefund
            ? "The card payment will be refunded through Stripe."
            : "Reserved stock is released. Refund any cash or e-Transfer payment yourself."
        }
      >
        <Input id="cancel-reason" name="reason" />
      </Field>
      <Button
        disabled={pending}
        variant="outline"
        className="self-start border-red-400/50 text-red-300"
      >
        Cancel order
      </Button>
      <Message state={state} />
    </form>
  );
}
