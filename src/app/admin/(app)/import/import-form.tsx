"use client";

import { FileSpreadsheet } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { importCsvAction, type ImportState } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importCsvAction, {});
  // Read the file from the input itself (not only onChange) so a file picked
  // before the page finished loading still counts. "Import" resends it.
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function submit(mode: "preview" | "apply") {
    const file = input.current?.files?.[0];
    const data = new FormData();
    if (file) {
      data.set("file", file);
      setFileName(file.name);
    }
    data.set("mode", mode);
    startTransition(() => action(data));
  }

  const rows = state.rows ?? [];
  const invalid = rows.filter((r) => !r.action);
  const creates = rows.filter((r) => r.action === "create").length;
  const updates = rows.filter((r) => r.action === "update").length;
  const previewed = state.mode === "preview" && state.fileName === fileName;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-surface-raised">
          <FileSpreadsheet aria-hidden="true" className="size-4" />
          {fileName ?? "Choose CSV file"}
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <Button variant="outline" disabled={pending} onClick={() => submit("preview")}>
          {pending ? "Checking…" : "Check file"}
        </Button>
        {previewed && invalid.length === 0 && (
          <Button disabled={pending} onClick={() => submit("apply")}>
            {pending ? "Importing…" : `Import ${creates + updates} products`}
          </Button>
        )}
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
          {state.error}
        </p>
      )}

      {state.mode && rows.length > 0 && (
        <div role="status" className="flex flex-col gap-3">
          <p
            className={cn(
              "rounded-lg border p-3 text-sm",
              state.mode === "applied"
                ? "border-emerald-400/40 bg-emerald-400/10"
                : invalid.length
                  ? "border-red-400/40 bg-red-400/10"
                  : "border-accent/40 bg-accent/10",
            )}
          >
            {state.mode === "applied"
              ? `Imported ${state.fileName}: ${creates} created, ${updates} updated.`
              : invalid.length
                ? `${invalid.length} of ${rows.length} rows have problems. Fix them in the spreadsheet and check the file again. Nothing has been imported.`
                : `${state.fileName} looks good: ${creates} new, ${updates} updated. Nothing is saved until you press Import.`}
          </p>
          <div className="max-h-[28rem] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.line} className={row.action ? "" : "bg-red-400/5"}>
                    <td className="px-3 py-2 tabular-nums">{row.line}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.sku || "—"}</td>
                    <td className="px-3 py-2">
                      {row.action ? (
                        <span className="text-muted">
                          {row.action === "create" ? "New product" : "Update"}
                        </span>
                      ) : (
                        <ul className="list-inside list-disc text-red-300">
                          {Object.entries(row.errors).map(([column, message]) => (
                            <li key={column}>
                              <span className="font-mono text-xs">{column}</span>: {message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
