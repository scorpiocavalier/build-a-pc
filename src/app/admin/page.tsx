import { Suspense } from "react";

import { signOut } from "@/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/require-admin";

export const metadata = { title: "Dashboard" };

export default function AdminHomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <span className="rounded-full border px-3 py-1 text-xs text-muted">Admin</span>
      </header>
      <Suspense fallback={<p className="text-muted">Checking your access…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const user = await requireAdmin();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name ?? user.email}</h1>
          <p className="text-muted">
            Products, inventory and orders will appear here as each phase ships.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/sign-in" });
          }}
        >
          <Button variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </section>
  );
}
