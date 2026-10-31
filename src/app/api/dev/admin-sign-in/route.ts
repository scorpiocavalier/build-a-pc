import { cookies } from "next/headers";

import { parseAdminEmails } from "@/server/admin-allowlist";
import { db } from "@/server/db";
import { createSessionFor, SESSION_COOKIE } from "@/server/dev-session";

// Development only: signs in as the first ADMIN_EMAILS address without Google,
// so the admin can be used locally before OAuth keys exist. `next build`
// sets NODE_ENV=production, so this is a 404 in every deployed environment.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  const [email] = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!email) {
    return new Response("Set ADMIN_EMAILS in .env first.", { status: 400 });
  }

  const session = await createSessionFor(db, email);
  (await cookies()).set(SESSION_COOKIE, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
  return Response.redirect(new URL("/admin", request.url), 303);
}
