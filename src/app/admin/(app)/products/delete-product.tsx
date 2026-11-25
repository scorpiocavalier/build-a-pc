"use client";

import { Trash2 } from "lucide-react";
import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { RemovalConfirmation } from "@/lib/catalog/product-removal";

import { deleteProductAction } from "./actions";

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button variant="danger" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

// The "Delete product" button and its confirmation, a native modal <dialog>:
// it traps focus, closes with Escape and gives focus back to the button.
export function DeleteProduct({
  productId,
  confirmation,
}: {
  productId: string;
  confirmation: RemovalConfirmation;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  return (
    <>
      <Button variant="danger" type="button" onClick={() => dialog.current?.showModal()}>
        <Trash2 aria-hidden="true" className="size-4" />
        Delete product
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border bg-surface p-5 text-foreground backdrop:bg-black/60"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {confirmation.title}
        </h2>
        <div id={bodyId} className="mt-3 flex flex-col gap-2 text-sm">
          {confirmation.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <form
          action={deleteProductAction.bind(null, productId)}
          className="mt-5 flex justify-end gap-2"
        >
          {/* Cancel comes first, so it gets focus and Enter doesn't delete by accident. */}
          <Button variant="outline" type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <ConfirmButton label={confirmation.confirmLabel} />
        </form>
      </dialog>
    </>
  );
}
