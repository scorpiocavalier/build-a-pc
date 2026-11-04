"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const SEARCH_DELAY_MS = 300;

// Filters without a full page reload or a Filter button: dropdowns apply
// right away and the search box applies after a short pause in typing.
// Pressing Enter in the search box still submits (also without JavaScript).
export function FilterForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const params = useSearchParams();
  const query = params.toString();
  const first = useRef(true);

  // When the URL changes some other way ("Clear filters", back/forward),
  // bring the fields in line with it. The field being typed in is left alone.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const current = new URLSearchParams(query);
    for (const el of Array.from(form.current?.elements ?? [])) {
      if (el === document.activeElement) continue;
      if (el instanceof HTMLSelectElement) {
        el.value = current.get(el.name) ?? el.options[0]?.value ?? "";
      } else if (el instanceof HTMLInputElement && el.name) {
        el.value = current.get(el.name) ?? "";
      }
    }
  }, [query]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Form
      ref={form}
      action="/admin/inventory"
      scroll={false}
      replace
      role="search"
      className="flex flex-wrap items-end gap-2"
      onSubmit={() => clearTimeout(timer.current)}
      onChange={(e) => {
        const target = e.target;
        clearTimeout(timer.current);
        if (target instanceof HTMLSelectElement) {
          e.currentTarget.requestSubmit();
        } else if (target instanceof HTMLInputElement) {
          const el = e.currentTarget;
          timer.current = setTimeout(() => el.requestSubmit(), SEARCH_DELAY_MS);
        }
      }}
    >
      {children}
    </Form>
  );
}
