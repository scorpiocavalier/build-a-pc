import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { signOut } from "@/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/require-admin";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/import", label: "CSV import" },
  { href: "/admin/builds", label: "Prebuilt PCs" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminAppLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-surface/60 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo />
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted">Admin</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-muted hover:bg-surface-raised hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/en"
              target="_blank"
              className="rounded-lg px-3 py-2 text-muted hover:bg-surface-raised hover:text-foreground"
            >
              View store ↗
            </Link>
          </nav>
          <form
            className="ml-auto"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/sign-in" });
            }}
          >
            <Button variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<p className="text-muted">Checking your access…</p>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}

// Nothing under /admin renders until the session is confirmed as an admin.
// Server actions still check again on their own (requireAdmin()).
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
