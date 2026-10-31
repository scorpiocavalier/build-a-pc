import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { isAdminEmail } from "@/server/admin-allowlist";
import { db } from "@/server/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; isAdmin: boolean } & DefaultSession["user"];
  }
}

// Providers are only enabled when their credentials are configured, so the
// app still boots locally without Google or Resend keys.
const providers: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_RESEND_KEY) {
  providers.push(Resend({ from: process.env.EMAIL_FROM }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The generated client lives outside @prisma/client, so the adapter's
  // parameter type doesn't recognise it even though the API is identical.
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "database" },
  providers,
  callbacks: {
    signIn({ user, account }) {
      // Admins must use Google (which enforces 2-step verification), never a
      // magic link that anyone with inbox access could use.
      if (isAdminEmail(user.email) && account?.provider !== "google") {
        return false;
      }
      return true;
    },
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = isAdminEmail(user.email);
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Keep the stored role in step with the allow-list for reporting.
      if (!user.id) return;
      const role = isAdminEmail(user.email) ? "ADMIN" : "CUSTOMER";
      await db.user.update({ where: { id: user.id }, data: { role } });
    },
  },
});
