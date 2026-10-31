"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import type { SettingsState } from "./actions";

// Wraps a settings form with its own save button and result message.
// With `keepValues`, what was typed survives a rejected submit (React clears
// forms after an action otherwise) and the form only clears once it's saved.
export function SettingsForm({
  action,
  children,
  label = "Save",
  keepValues = false,
}: {
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  children: ReactNode;
  label?: string;
  keepValues?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (keepValues && state.saved) form.current?.reset();
  }, [keepValues, state]);

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={
        keepValues
          ? (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(() => formAction(data));
            }
          : undefined
      }
      className="flex flex-col gap-4"
    >
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
