"use client";

import Form from "next/form";
import type { ReactNode } from "react";

// Filters without a full page reload: submitting updates the URL with a
// client-side navigation, and changing a dropdown applies it right away.
export function FilterForm({ children }: { children: ReactNode }) {
  return (
    <Form
      action="/admin/inventory"
      scroll={false}
      replace
      role="search"
      className="flex flex-wrap items-end gap-2"
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}
