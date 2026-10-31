import "server-only";

import { headers } from "next/headers";

import { db } from "@/server/db";

// Simple fixed-window rate limits kept in Postgres, so they hold across
// serverless instances without another service. Used on sign-in, checkout,
// search and return requests.

export const LIMITS = {
  signInIp: { limit: 10, windowSeconds: 15 * 60 },
  signInEmail: { limit: 3, windowSeconds: 15 * 60 },
  checkout: { limit: 20, windowSeconds: 10 * 60 },
  search: { limit: 60, windowSeconds: 60 },
  returnRequest: { limit: 5, windowSeconds: 60 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

// The visitor's IP. On Vercel the first X-Forwarded-For entry is set by the
// platform and can't be spoofed by the client.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

// Counts one attempt; false once the limit for this window is used up.
export async function hit(name: LimitName, subject: string): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[name];
  const key = `${name}:${subject.toLowerCase()}`.slice(0, 200);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" (key, count, "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit".count + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now()
                  THEN now() + make_interval(secs => ${windowSeconds})
                  ELSE "RateLimit"."resetAt" END
    RETURNING count`;
  return rows[0].count <= limit;
}

// Shorthand: limit by the visitor's IP.
export async function hitByIp(name: LimitName): Promise<boolean> {
  return hit(name, await clientIp());
}

export async function clearExpiredLimits() {
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
