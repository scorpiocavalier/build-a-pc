// The storefront's main pages, shown in the desktop header and the mobile
// menu. Edit this list to add, remove or reorder them in both places.
export const NAV_LINKS = [
  { href: "/build", labelKey: "nav.builder" },
  { href: "/prebuilt", labelKey: "nav.prebuilt" },
] as const;

export type NavItem = { href: string; label: string };

// A row in the mobile menu.
export const menuLink =
  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base text-muted hover:bg-surface-raised hover:text-foreground aria-[current=page]:bg-surface-raised aria-[current=page]:font-medium aria-[current=page]:text-foreground";
