"use client";

import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { NavLink } from "@/components/nav-link";
import { menuLink, type NavItem } from "@/components/nav-links";

// Below the desktop breakpoint, the header's links live in this sheet. The
// Radix dialog traps focus, closes on Escape or an outside tap, returns focus
// to the button and stops the page behind from scrolling.
export function MobileMenu({
  labels,
  links,
  search,
  children,
}: {
  labels: { menu: string; close: string };
  links: NavItem[];
  search: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Close it if the window grows to the desktop layout, where it's hidden.
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onChange = () => desktop.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open]);

  // Choosing any link closes the menu.
  function onClick(event: MouseEvent) {
    if ((event.target as Element).closest("a")) setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="rounded-lg p-1 text-muted hover:bg-surface-raised hover:text-foreground min-[360px]:p-1.5 min-[400px]:p-2 lg:hidden">
        <Menu aria-hidden="true" className="size-5" />
        <span className="sr-only">{labels.menu}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 motion-safe:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onClick={onClick}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col gap-4 overflow-y-auto border-l bg-background p-4 shadow-xl motion-safe:animate-sheet-in"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{labels.menu}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-2 text-muted hover:bg-surface-raised hover:text-foreground">
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">{labels.close}</span>
            </Dialog.Close>
          </div>
          {search}
          <nav aria-label={labels.menu} className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href} className={menuLink}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            {children}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
