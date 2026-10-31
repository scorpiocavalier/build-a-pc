import { createHmac, randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";
import type pg from "pg";

// Helpers for order tests. Each test creates its own product so tests can run
// in parallel and repeatedly without using up the seeded stock.

export async function createProduct(
  sql: pg.Client,
  options: { stockTOR?: number; stockMTL?: number; priceCents?: number } = {},
) {
  const id = randomUUID();
  const sku = `E2E-${id.slice(0, 8).toUpperCase()}`;
  const slug = sku.toLowerCase();
  const name = `Test Fan ${sku}`;
  await sql.query(
    `INSERT INTO "Product" (id, slug, sku, name, description, "brandId", "categoryId", specs, "priceCents", status, "updatedAt")
     SELECT $1, $2, $3, $4, '{"en":"","fr":""}',
            (SELECT id FROM "Brand" ORDER BY slug LIMIT 1),
            (SELECT id FROM "Category" WHERE slug = 'cooler'),
            '{"type":"air","sockets":["AM5"],"heightMm":150}', $5, 'ACTIVE', now()`,
    [
      id,
      slug,
      sku,
      JSON.stringify({ en: name, fr: `Ventilateur ${sku}` }),
      options.priceCents ?? 10000,
    ],
  );
  for (const [code, onHand] of [
    ["TOR", options.stockTOR ?? 20],
    ["MTL", options.stockMTL ?? 20],
  ] as const) {
    await sql.query(
      `INSERT INTO "Inventory" ("productId", "locationId", "onHand") SELECT $1, id, $2 FROM "Location" WHERE code = $3`,
      [id, onHand, code],
    );
  }
  return { id, sku, slug, name };
}

export async function stock(sql: pg.Client, productId: string, code: "TOR" | "MTL") {
  const { rows } = await sql.query<{ onHand: number; reserved: number }>(
    `SELECT i."onHand", i.reserved FROM "Inventory" i JOIN "Location" l ON l.id = i."locationId"
     WHERE i."productId" = $1 AND l.code = $2`,
    [productId, code],
  );
  return rows[0];
}

export async function orderFor(sql: pg.Client, email: string) {
  const { rows } = await sql.query(
    `SELECT id, number, status, "paymentStatus", "paymentMethod", "paidCents", "totalCents", "deliveryCents", "accessToken"
     FROM "Order" WHERE email = $1 ORDER BY "placedAt" DESC LIMIT 1`,
    [email],
  );
  return rows[0];
}

export const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

export async function addToCart(page: Page, slug: string, locale = "en", quantity = 1) {
  await page.goto(`/${locale}/p/${slug}`);
  if (quantity > 1) await page.locator('select[name="quantity"]').selectOption(String(quantity));
  await page.locator("form button:has(svg.lucide-shopping-cart)").click();
  await page.getByRole("status").filter({ hasText: /\d/ }).first().waitFor();
}

export async function fillContactAndWindow(page: Page, email: string) {
  await page.locator("#name").fill("Alex Tremblay");
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("514 555 0199");
  await page.locator("#date").selectOption({ index: 2 });
  await page.locator("#slot").selectOption("afternoon");
  await page.locator('input[name="terms"]').check();
}

// Signs a payload the way Stripe does ("t=<ts>,v1=<hmac>"), so the webhook
// route can be tested without contacting Stripe.
export function stripeSignature(payload: string, secret = process.env.STRIPE_WEBHOOK_SECRET!) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function checkoutEvent(
  type: "checkout.session.completed" | "checkout.session.expired",
  orderId: string,
  amountCents: number,
) {
  return JSON.stringify({
    id: `evt_${randomUUID().replaceAll("-", "")}`,
    object: "event",
    type,
    api_version: "2026-03-25.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_${orderId}`,
        object: "checkout.session",
        payment_status: type === "checkout.session.completed" ? "paid" : "unpaid",
        amount_total: amountCents,
        payment_intent: `pi_test_${orderId}`,
        metadata: { orderId },
      },
    },
  });
}
