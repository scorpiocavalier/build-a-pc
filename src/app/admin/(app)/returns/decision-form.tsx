"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

import type { SettingsState } from "../settings/actions";

import { decideReturnAction } from "./actions";

export function DecisionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    decideReturnAction.bind(null, id),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="Message to the customer"
        htmlFor={`note-${id}`}
        hint="Sent with the decision. Required when declining; for approvals, say where and when to bring the items."
      >
        <Textarea id={`note-${id}`} name="note" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button name="decision" value="APPROVED" size="sm" disabled={pending}>
          Approve
        </Button>
        <Button name="decision" value="DECLINED" size="sm" variant="outline" disabled={pending}>
          Decline
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
