import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

// Creates an Auth.js database session for an email, the same way a real
// sign-in would. Only used by the development sign-in route and e2e tests.

export const SESSION_COOKIE = "authjs.session-token";

export async function createSessionFor(db: PrismaClient, email: string) {
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "Dev Admin", emailVerified: new Date() },
    update: {},
  });
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });
  return { sessionToken, expires, userId: user.id };
}
