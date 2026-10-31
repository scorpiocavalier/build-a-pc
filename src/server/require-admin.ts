import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";

// Call at the start of every admin page and admin server action. The proxy
// only does a cheap cookie check; this is the real authorization.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/admin/sign-in");
  if (!session.user.isAdmin) redirect("/admin/sign-in?error=AccessDenied");
  return session.user;
}
