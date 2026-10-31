import { Suspense } from "react";

import { signIn } from "@/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied: "This account isn't allowed into the admin. Use an approved Google account.",
};

export default function AdminSignInPage({ searchParams }: PageProps<"/admin/sign-in">) {
  const googleConfigured = !!process.env.AUTH_GOOGLE_ID;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <Logo className="text-lg" />
      <div>
        <h1 className="text-2xl font-semibold">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Staff only. Sign in with your approved Google account.
        </p>
      </div>
      <Suspense>
        <SignInError searchParams={searchParams} />
      </Suspense>
      {googleConfigured ? (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/admin" });
          }}
        >
          <Button className="w-full">Continue with Google</Button>
        </form>
      ) : (
        <p className="rounded-lg border bg-surface p-4 text-sm text-muted">
          Google sign-in isn&apos;t configured. Set <code>AUTH_GOOGLE_ID</code> and{" "}
          <code>AUTH_GOOGLE_SECRET</code> in your environment.
        </p>
      )}
    </div>
  );
}

async function SignInError({ searchParams }: Pick<PageProps<"/admin/sign-in">, "searchParams">) {
  const { error } = await searchParams;
  if (typeof error !== "string") return null;
  return (
    <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">
      {ERRORS[error] ?? "Sign-in failed. Please try again."}
    </p>
  );
}
