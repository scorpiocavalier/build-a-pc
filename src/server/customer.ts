import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { db } from "@/server/db";

// The signed-in storefront customer, or null for guests. Admins are
// customers too when they shop.
export async function getCustomer() {
  // Auth.js generates random values before reading cookies; mark this as
  // request-time work so prerendering stops here instead of erroring.
  await connection();
  const session = await auth();
  return session?.user?.id ? { id: session.user.id, email: session.user.email ?? "" } : null;
}

export type Customer = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

// For account pages and actions: guests go to sign-in, then come back.
export async function requireCustomer(locale: string, next: string): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer) redirect(`/${locale}/sign-in?next=${encodeURIComponent(next)}`);
  return customer;
}

export async function getCustomerProfile(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, locale: true, createdAt: true },
  });
}
