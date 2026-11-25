"use client";

import type { ComponentProps } from "react";

import { Link, usePathname } from "@/i18n/navigation";

// A link that marks itself as the current page (aria-current="page") or as
// the section the current page is in ("true"). It reads the URL, so render it
// inside a Suspense boundary, or only on the client (as in the mobile menu).
export function NavLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();
  const current = pathname === href ? "page" : pathname.startsWith(`${href}/`) ? "true" : undefined;
  return <Link href={href} aria-current={current} {...props} />;
}
