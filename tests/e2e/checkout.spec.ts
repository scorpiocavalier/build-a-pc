import { expect, test } from "./fixtures";
import {
  addToCart,
  checkoutEvent,
  createProduct,
  fillContactAndWindow,
  orderFor,
  stock,
  stripeSignature,
  uniqueEmail,
} from "./shop-helpers";

// Placing orders changes stock, so these run once, on desktop.
test.skip(({ isMobile }) => isMobile, "order tests run once, on desktop");

test("guest pays by e-Transfer for a Montreal pickup, in French", async ({ page, sql }) => {
  const product = await createProduct(sql, { priceCents: 10000 });
  const email = uniqueEmail("etransfer");

  await addToCart(page, product.slug, "fr", 2);
  await page.goto("/fr/cart");
  await expect(page.getByText("Disponible à Toronto, Montréal")).toBeVisible();
  await page.getByRole("link", { name: "Passer à la caisse" }).click();

  await page.getByRole("button", { name: "Cueillette à Montréal" }).click();
  // Card payments are hidden until Stripe is configured.
  await expect(page.getByRole("radio")).toHaveCount(2);
  await fillContactAndWindow(page, email);
  await page.getByRole("radio", { name: /Virement Interac/ }).check();
  await page.getByRole("button", { name: "Passer la commande" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merci, Alex!");
  await expect(page.getByText("Comment payer par virement Interac")).toBeVisible();
  await expect(page.getByText("Non payée · Virement Interac")).toBeVisible();
  // Stock is held for the order but not deducted yet.
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 20, reserved: 2 });

  const order = await orderFor(sql, email);
  expect(order).toMatchObject({ status: "PLACED", paymentMethod: "ETRANSFER", totalCents: 20000 });
});

test("delivery checks the postal code and adds the delivery fee", async ({ page, sql }) => {
  const product = await createProduct(sql);
  const email = uniqueEmail("delivery");
  await addToCart(page, product.slug);

  await page.goto("/en/checkout");
  await page.getByLabel("Postal code").fill("K1A 0B1");
  await page.getByRole("button", { name: "Check delivery" }).click();
  await expect(page.getByText("We don't deliver to K1A 0B1 yet.")).toBeVisible();

  await page.getByLabel("Postal code").fill("m5v3l9");
  await page.getByRole("button", { name: "Check delivery" }).click();
  await expect(page.getByText("Delivery from our Toronto location to M5V 3L9")).toBeVisible();
  const summary = page.getByRole("complementary", { name: "Order summary" });
  await expect(summary.getByText("Delivery")).toBeVisible();

  await fillContactAndWindow(page, email);
  await page.getByRole("radio", { name: /Cash/ }).check();
  await expect(page.locator("#line1")).toHaveAttribute("required", "");
  await page.locator("#line1").fill("100 King St W");
  await page.locator("#city").fill("Toronto");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Delivery to 100 King St W, Toronto, ON M5V 3L9")).toBeVisible();
  await expect(page.getByText(/Pay \$\d+\.\d\d in cash/)).toBeVisible();
  expect(await orderFor(sql, email)).toMatchObject({ paymentMethod: "CASH", deliveryCents: 2500 });
});

test("checkout blocks items without enough stock at the chosen location", async ({ page, sql }) => {
  const product = await createProduct(sql, { stockTOR: 1, stockMTL: 0 });
  await addToCart(page, product.slug, "en", 1);
  await page.goto("/en/checkout?f=pickup&l=MTL");
  await expect(page.getByText("Not enough stock in Montreal for:")).toBeVisible();
  await expect(page.locator("#name")).toHaveCount(0);

  await page.goto("/en/checkout?f=pickup&l=TOR");
  await expect(page.locator("#name")).toBeVisible();
});

test("the last unit can't be sold twice", async ({ browser, sql }) => {
  const product = await createProduct(sql, { stockTOR: 1, stockMTL: 0 });
  const [first, second] = await Promise.all([browser.newPage(), browser.newPage()]);
  for (const page of [first, second]) {
    await addToCart(page, product.slug);
    await page.goto("/en/checkout?f=pickup&l=TOR");
    await fillContactAndWindow(page, uniqueEmail("race"));
  }
  await first.getByRole("button", { name: "Place order" }).click();
  await expect(first.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();

  await second.getByRole("button", { name: "Place order" }).click();
  await expect(second.getByRole("alert").filter({ hasText: "no longer available" })).toBeVisible();
  expect(await stock(sql, product.id, "TOR")).toEqual({ onHand: 1, reserved: 1 });
});

test("Stripe webhooks mark card orders paid once, and expired sessions release stock", async ({
  page,
  request,
  sql,
}) => {
  const product = await createProduct(sql);
  const paidEmail = uniqueEmail("card-paid");
  const expiredEmail = uniqueEmail("card-expired");

  // Place two orders, then turn them into card orders as if Stripe were on.
  for (const email of [paidEmail, expiredEmail]) {
    await addToCart(page, product.slug);
    await page.goto("/en/checkout?f=pickup&l=TOR");
    await fillContactAndWindow(page, email);
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();
  }
  await sql.query(`UPDATE "Order" SET "paymentMethod" = 'CARD' WHERE email = ANY($1)`, [
    [paidEmail, expiredEmail],
  ]);
  const paid = await orderFor(sql, paidEmail);
  const expired = await orderFor(sql, expiredEmail);

  const bad = await request.post("/api/webhooks/stripe", {
    data: checkoutEvent("checkout.session.completed", paid.id, paid.totalCents),
    headers: { "stripe-signature": "t=1,v1=forged", "content-type": "application/json" },
  });
  expect(bad.status()).toBe(400);

  const payload = checkoutEvent("checkout.session.completed", paid.id, paid.totalCents);
  for (const expectDuplicate of [false, true]) {
    const response = await request.post("/api/webhooks/stripe", {
      data: payload,
      headers: { "stripe-signature": stripeSignature(payload), "content-type": "application/json" },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject(
      expectDuplicate ? { duplicate: true } : { received: true },
    );
  }
  expect(await orderFor(sql, paidEmail)).toMatchObject({
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paidCents: paid.totalCents,
  });

  const expiredPayload = checkoutEvent("checkout.session.expired", expired.id, expired.totalCents);
  await request.post("/api/webhooks/stripe", {
    data: expiredPayload,
    headers: {
      "stripe-signature": stripeSignature(expiredPayload),
      "content-type": "application/json",
    },
  });
  expect(await orderFor(sql, expiredEmail)).toMatchObject({ status: "CANCELLED" });
  // One unit still held by the paid order; the expired one was released.
  expect(await stock(sql, product.id, "TOR")).toEqual({ onHand: 20, reserved: 1 });

  await page.goto(`/en/orders/${paid.id}?t=${paid.accessToken}`);
  await expect(page.getByText("Paid · Card")).toBeVisible();
  await page.goto(`/en/orders/${paid.id}?t=wrong-token`);
  await expect(page.getByText("We couldn't find that order.")).toBeVisible();
});

test("the hourly job cancels unpaid orders past their hold", async ({ page, request, sql }) => {
  const product = await createProduct(sql);
  const email = uniqueEmail("expiry");
  await addToCart(page, product.slug);
  await page.goto("/en/checkout?f=pickup&l=MTL");
  await fillContactAndWindow(page, email);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();

  expect((await request.get("/api/cron/expire-orders")).status()).toBe(401);

  await sql.query(`UPDATE "Order" SET "holdUntil" = now() - interval '1 minute' WHERE email = $1`, [
    email,
  ]);
  const response = await request.get("/api/cron/expire-orders", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).cancelled).toBeGreaterThanOrEqual(1);
  expect(await orderFor(sql, email)).toMatchObject({ status: "CANCELLED" });
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 20, reserved: 0 });
});
