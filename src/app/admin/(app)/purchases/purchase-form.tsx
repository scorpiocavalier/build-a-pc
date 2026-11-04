"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { landedUnitCosts, type CostSplit } from "@/lib/inventory/cost";
import { parseDollars } from "@/lib/money";

import { purchaseAction } from "./actions";

type Line = { key: number; sku: string; quantity: string; unitCost: string };

const blank = (key: number): Line => ({ key, sku: "", quantity: "", unitCost: "" });
const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

export function PurchaseForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(purchaseAction, {});
  const [lines, setLines] = useState<Line[]>([blank(0), blank(1), blank(2)]);
  const [extra, setExtra] = useState({ shipping: "", duties: "", other: "" });
  const [split, setSplit] = useState<CostSplit>("VALUE");
  const nextKey = useRef(3);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.saved) return;
    form.current?.reset();
    setLines([blank(nextKey.current++), blank(nextKey.current++), blank(nextKey.current++)]);
    setExtra({ shipping: "", duties: "", other: "" });
    setSplit("VALUE");
  }, [state]);

  const update = (key: number, field: keyof Omit<Line, "key">, value: string) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  // Live preview of each line's landed cost, using the same maths as the server.
  const parsed = lines.map((l) => ({
    quantity: Number(l.quantity),
    unitCostCents: parseDollars(l.unitCost),
  }));
  const valid = parsed.map(
    (p) => Number.isInteger(p.quantity) && p.quantity > 0 && p.unitCostCents !== null,
  );
  const extraCents = Object.values(extra).reduce((s, v) => s + (parseDollars(v) ?? 0), 0);
  const counted = parsed.filter((_, i) => valid[i]) as {
    quantity: number;
    unitCostCents: number;
  }[];
  const landed = landedUnitCosts(counted, extraCents, split);
  const landedFor = (i: number) =>
    valid[i] ? landed[valid.slice(0, i).filter(Boolean).length] : null;
  const total = counted.reduce((s, l) => s + l.quantity * l.unitCostCents, 0) + extraCents;

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        // Submit by hand so what was typed survives an error.
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Received at" htmlFor="purchase-location">
          <Select id="purchase-location" name="location" defaultValue="TOR">
            <option value="TOR">Toronto</option>
            <option value="MTL">Montreal</option>
          </Select>
        </Field>
        <Field label="Supplier" htmlFor="purchase-supplier">
          <Input id="purchase-supplier" name="supplier" required />
        </Field>
        <Field label="Invoice or order # (optional)" htmlFor="purchase-reference">
          <Input id="purchase-reference" name="reference" />
        </Field>
        <Field label="Purchase date" htmlFor="purchase-date">
          <Input
            id="purchase-date"
            name="purchasedAt"
            type="date"
            defaultValue={today}
            max={today}
            required
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Products</legend>
        <div className="hidden grid-cols-[1fr_6rem_8rem_8rem_2rem] gap-2 text-xs text-muted sm:grid">
          <span>SKU</span>
          <span>Units</span>
          <span>Unit cost</span>
          <span className="text-right">Landed per unit</span>
          <span />
        </div>
        {lines.map((line, i) => {
          const cost = landedFor(i);
          return (
            <div
              key={line.key}
              className="grid grid-cols-[1fr_5rem_7rem] items-center gap-2 sm:grid-cols-[1fr_6rem_8rem_8rem_2rem]"
            >
              <Input
                name="sku"
                list="skus"
                aria-label={`SKU, line ${i + 1}`}
                value={line.sku}
                onChange={(e) => update(line.key, "sku", e.target.value)}
              />
              <Input
                name="quantity"
                inputMode="numeric"
                aria-label={`Units, line ${i + 1}`}
                value={line.quantity}
                onChange={(e) => update(line.key, "quantity", e.target.value)}
              />
              <Input
                name="unitCost"
                inputMode="decimal"
                placeholder="0.00"
                aria-label={`Unit cost, line ${i + 1}`}
                value={line.unitCost}
                onChange={(e) => update(line.key, "unitCost", e.target.value)}
              />
              <span
                className="col-span-2 text-right text-sm text-muted tabular-nums sm:col-span-1"
                aria-label={`Landed cost per unit, line ${i + 1}`}
              >
                {cost === null ? "—" : money(cost)}
              </span>
              <button
                type="button"
                className="text-muted hover:text-foreground disabled:opacity-30"
                aria-label={`Remove line ${i + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
              >
                ×
              </button>
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((all) => [...all, blank(nextKey.current++)])}
          >
            Add a line
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["shipping", "Shipping"],
            ["duties", "Duties and customs"],
            ["other", "Other fees"],
          ] as const
        ).map(([name, label]) => (
          <Field key={name} label={label} htmlFor={`purchase-${name}`}>
            <Input
              id={`purchase-${name}`}
              name={name}
              inputMode="decimal"
              placeholder="0.00"
              value={extra[name]}
              onChange={(e) => setExtra((x) => ({ ...x, [name]: e.target.value }))}
            />
          </Field>
        ))}
        <Field label="Spread fees by" htmlFor="purchase-split">
          <Select
            id="purchase-split"
            name="split"
            value={split}
            onChange={(e) => setSplit(e.target.value as CostSplit)}
          >
            <option value="VALUE">Value (pricier items carry more)</option>
            <option value="UNITS">Units (same share each)</option>
          </Select>
        </Field>
        <Field label="Note (optional)" htmlFor="purchase-note" className="sm:col-span-4">
          <Input id="purchase-note" name="note" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} size="sm">
          {pending ? "Saving…" : "Receive stock"}
        </Button>
        <span className="text-sm text-muted">Total {money(total)}</span>
        <p
          role="status"
          className={state.error ? "text-sm text-red-300" : "text-sm text-emerald-300"}
        >
          {state.error ?? state.saved ?? ""}
        </p>
      </div>
    </form>
  );
}
