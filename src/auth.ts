import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { isAdminEmail } from "@/server/admin-allowlist";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { buildSignInEmail } from "@/server/email/sign-in-email";

declare module "next-auth" {
  interface Session {
    user: { id: string; isAdmin: boolean } & DefaultSession["user"];
  }
}

// Providers are only enabled when their credentials are configured, so the
// app still boots locally without Google or Resend keys.
const providers: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);

// Customers sign in with a link sent by email. Without a Resend key the link
// is printed to the server log, which is only acceptable outside production
// (or when browser tests collect emails from EMAIL_OUTBOX_DIR).
export const emailSignInEnabled =
  !!process.env.AUTH_RESEND_KEY ||
  !!process.env.EMAIL_OUTBOX_DIR ||
  process.env.NODE_ENV !== "production";
if (emailSignInEnabled) {
  providers.push(
    Resend({
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        await sendEmail(buildSignInEmail(identifier, url));
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The generated client lives outside @prisma/client, so the adapter's
  // parameter type doesn't recognise it even though the API is identical.
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "database" },
  providers,
  // Expired or reused sign-in links land back on the storefront sign-in page,
  // which shows the error. The proxy adds the visitor's language.
  pages: { error: "/sign-in" },
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
      // The email address is verified now (magic link or Google), so guest
      // orders placed with it belong in this account.
      if (user.email) {
        await db.order.updateMany({
          where: { userId: null, email: { equals: user.email, mode: "insensitive" } },
          data: { userId: user.id },
        });
      }
    },
  },
});
