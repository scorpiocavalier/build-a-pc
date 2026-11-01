import { connection } from "next/server";

import { expireOrders } from "@/server/orders/lifecycle";
import { clearExpiredLimits } from "@/server/rate-limit";

// Hourly (vercel.json): cancels unpaid orders whose hold ran out and frees
// their stock, and clears old rate-limit counters. Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const cancelled = await expireOrders();
  await clearExpiredLimits();
  return Response.json({ cancelled });
}
