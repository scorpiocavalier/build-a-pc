import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { test as base, type Page } from "@playwright/test";
import pg from "pg";

// Signs a browser context in by creating a real Auth.js database session
// (the same rows a Google sign-in creates), skipping Google itself. Uses
// plain SQL because Prisma's generated client is ESM-only, which Playwright's
// test loader can't import. Needs the same DATABASE_URL as the app.

const SESSION_COOKIE = "authjs.session-token";

type Fixtures = {
  sql: pg.Client;
  signInAs: (email: string) => Promise<Page>;
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  // Each test looks like a different visitor, so the app's per-IP rate limits
  // (src/server/rate-limit.ts) don't carry over between tests and reruns.
  extraHTTPHeaders: async ({}, provide) => {
    const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
    await provide({ "x-forwarded-for": ip });
  },
  // `provide` is Playwright's fixture callback (named to avoid React's `use` lint rule).
  sql: async ({}, provide) => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await provide(client);
    await client.end();
  },
  signInAs: async ({ sql, context, baseURL, page }, provide) => {
    await provide(async (email) => {
      const { rows } = await sql.query<{ id: string }>(
        `INSERT INTO "User" (id, email, name, "emailVerified", "updatedAt")
         VALUES ($1, $2, 'E2E User', now(), now())
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [randomUUID(), email],
      );
      const token = randomBytes(32).toString("hex");
      await sql.query(
        `INSERT INTO "Session" ("sessionToken", "userId", expires, "updatedAt")
         VALUES ($1, $2, now() + interval '1 day', now())`,
        [token, rows[0].id],
      );
      await context.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL! }]);
      return page;
    });
  },
  adminPage: async ({ signInAs }, provide) => {
    const email = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
    if (!email) throw new Error("Set ADMIN_EMAILS to run admin tests");
    await provide(await signInAs(email));
  },
});

export { expect } from "@playwright/test";
