"use client";

import { useActionState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import type { SettingsState } from "./actions";

// Wraps a settings form with its own save button and result message.
export function SettingsForm({
  action,
  children,
  label = "Save",
}: {
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  children: ReactNode;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      <div className="flex items-center gap-3">
        <Button disabled={pending} size="sm">
          {pending ? "Saving…" : label}
        </Button>
        <p
          role="status"
          className={state.error ? "text-sm text-red-300" : "text-sm text-emerald-300"}
        >
          {state.error ?? (state.saved ? "Saved." : "")}
        </p>
      </div>
    </form>
  );
}
