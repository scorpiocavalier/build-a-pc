import { expect, test } from "./fixtures";
import {
  completeOrder,
  createProduct,
  latestEmailTo,
  placePickupOrder,
  stock,
  stripeSignature,
  uniqueEmail,
} from "./shop-helpers";

test.skip(({ isMobile }) => isMobile, "admin data tests run once, on desktop");

// Today's date in the stores' time zone, as "YYYY-MM-DD".
const storeToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

test("staff book a pickup time, which the customer sees and the Today view lists", async ({
  page,
  adminPage,
  sql,
}) => {
  const email = uniqueEmail("schedule");
  const { order } = await placePickupOrder(page, sql, email);
  await sql.query(`UPDATE "Order" SET status = 'CONFIRMED', "holdUntil" = NULL WHERE id = $1`, [
    order.id,
  ]);

  await adminPage.goto("/admin?location=MTL");
  const unscheduled = adminPage.getByRole("region", { name: "Needs a pickup or delivery time" });
  await expect(
    unscheduled.getByRole("link", { name: `ATG-${10000 + order.number}` }),
  ).toBeVisible();

  await adminPage.goto(`/admin/orders/${order.id}`);
  await adminPage.getByLabel("Date").fill(storeToday());
  await adminPage.getByLabel("Time").fill("23:30");
  await adminPage.getByRole("button", { name: "Confirm time" }).click();
  await expect(adminPage.getByText("Customer emailed.")).toBeVisible();
  await expect(adminPage.getByText(/Booked for .* 11:30 p\.m\./)).toBeVisible();

  const mail = await latestEmailTo(email);
  expect(mail.subject).toBe(`Order ATG-${10000 + order.number}: time confirmed`);
  expect(mail.text).toContain("11:30 p.m.");

  await adminPage.goto("/admin?location=MTL");
  const booked = adminPage.getByRole("region", { name: "Booked for today" });
  await expect(booked.getByRole("link", { name: `ATG-${10000 + order.number}` })).toBeVisible();
  // Toronto's view doesn't include Montreal orders.
  await adminPage.goto("/admin?location=TOR");
  await expect(
    adminPage
      .getByRole("region", { name: "Booked for today" })
      .getByRole("link", { name: `ATG-${10000 + order.number}` }),
  ).toHaveCount(0);

  await page.goto(`/en/orders/${order.id}?t=${order.accessToken}`);
  await expect(page.getByText(/Booked for .* 11:30 p\.m\./)).toBeVisible();
});

test("stock moves between locations and adjustments are logged", async ({ adminPage, sql }) => {
  const product = await createProduct(sql, { stockTOR: 20, stockMTL: 3 });
  const page = adminPage;
  await page.goto("/admin/inventory");

  const move = page.getByRole("region", { name: "Move stock" });
  await move.getByLabel("SKU").fill(product.sku);
  await move.getByLabel("Units").fill("50");
  await move.getByRole("button", { name: "Move stock" }).click();
  await expect(move.getByText("Not enough free stock in TOR to move.")).toBeVisible();
  await move.getByLabel("Units").fill("5");
  await move.getByLabel("Note (optional)").fill("Weekly restock");
  await move.getByRole("button", { name: "Move stock" }).click();
  await expect(move.getByText("Saved.")).toBeVisible();
  expect(await stock(sql, product.id, "TOR")).toEqual({ onHand: 15, reserved: 0 });
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 8, reserved: 0 });

  const adjust = page.getByRole("region", { name: "Adjust stock" });
  await adjust.getByLabel("SKU").fill(product.sku);
  await adjust.getByLabel("Change").fill("-2");
  await adjust.getByLabel("Location").selectOption("MTL");
  await adjust.getByLabel("Type").selectOption("WRITE_OFF");
  await adjust.getByLabel("Reason").fill("Damaged box");
  await adjust.getByRole("button", { name: "Save adjustment" }).click();
  await expect(adjust.getByText("Saved.")).toBeVisible();
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 6, reserved: 0 });

  await page.goto(`/admin/inventory?q=${product.sku}`);
  await expect(
    page.getByRole("heading", { name: `Stock history for ${product.sku}` }),
  ).toBeVisible();
  await expect(page.getByText("write-off · Damaged box")).toBeVisible();
  await expect(page.getByText("transfer · From TOR: Weekly restock")).toBeVisible();

  await page.goto(`/admin/audit?q=${product.sku}`);
  await expect(
    page.getByText(`Moved 5 × ${product.sku} from TOR to MTL (Weekly restock)`),
  ).toBeVisible();
  await expect(page.getByText(`-2 × ${product.sku} in MTL: Damaged box`)).toBeVisible();
});

test("a received return is restocked and refunded with the restocking fee", async ({
  page,
  adminPage,
  sql,
}) => {
  const email = uniqueEmail("refund");
  const { order, product } = await placePickupOrder(page, sql, email);
  await completeOrder(sql, order.id);
  // The sale took both units out of stock at handover.
  await sql.query(
    `UPDATE "Inventory" SET "onHand" = "onHand" - 2, reserved = reserved - 2 WHERE "productId" = $1`,
    [product.id],
  );
  const { rows } = await sql.query(
    `INSERT INTO "ReturnRequest" (id, "orderId", status, reason, details, "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'APPROVED', 'CHANGED_MIND', 'Not needed', now())
     RETURNING id, number`,
    [order.id],
  );
  const line = await sql.query(`SELECT id FROM "OrderLine" WHERE "orderId" = $1`, [order.id]);
  await sql.query(
    `INSERT INTO "ReturnLine" (id, "returnId", "orderLineId", quantity)
     VALUES (gen_random_uuid()::text, $1, $2, 1)`,
    [rows[0].id, line.rows[0].id],
  );
  const rma = `RMA-${rows[0].number}`;

  await adminPage.goto("/admin/returns?show=approved");
  const request = adminPage.getByRole("region", { name: rma });
  // $100 item, 30% fee, no tax collected in Quebec yet.
  await expect(request.getByTestId("refund-total")).toHaveText("$70.00");
  await request.getByLabel("Restocking fee ($)").fill("20");
  await expect(request.getByTestId("refund-total")).toHaveText("$80.00");
  await request.getByLabel("Refund by").selectOption("ETRANSFER");
  await request.getByRole("button", { name: "Receive items and refund $80.00" }).click();
  await expect(request).toHaveCount(0);

  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 19, reserved: 0 });
  const after = await sql.query(
    `SELECT "refundedCents", "paymentStatus" FROM "Order" WHERE id = $1`,
    [order.id],
  );
  expect(after.rows[0]).toEqual({ refundedCents: 8000, paymentStatus: "PARTIALLY_REFUNDED" });
  expect((await latestEmailTo(email)).subject).toBe(`Return ${rma}: refund of $80.00`);

  await page.goto(`/en/orders/${order.id}?t=${order.accessToken}`);
  await expect(page.getByText("Refunded $80.00. Restocking fee: $20.00.")).toBeVisible();
  await expect(page.getByText("Partly refunded · Interac e-Transfer")).toBeVisible();

  await adminPage.goto(`/admin/orders/${order.id}`);
  await expect(adminPage.getByText(/etransfer · −\$80\.00 · RMA-/)).toBeVisible();
});

test("cancelling records cash and e-Transfer refunds staff give back", async ({
  page,
  adminPage,
  sql,
}) => {
  const email = uniqueEmail("cancel-refund");
  const { order, product } = await placePickupOrder(page, sql, email);
  await adminPage.goto(`/admin/orders/${order.id}`);
  await adminPage.locator("#pay-amount").fill("50");
  await adminPage.getByRole("button", { name: "Record payment" }).click();
  await expect(adminPage.getByText(/etransfer · \$50\.00 · succeeded/)).toBeVisible();

  await adminPage.getByLabel("Reason (sent to the customer)").fill("Customer changed plans");
  await adminPage.getByLabel(/I've given back the \$50\.00/).check();
  await adminPage.getByRole("button", { name: "Cancel order" }).click();
  await expect(adminPage.getByText(/etransfer · −\$50\.00 · Order cancelled/)).toBeVisible();

  const after = await sql.query(
    `SELECT status, "paidCents", "paymentStatus" FROM "Order" WHERE id = $1`,
    [order.id],
  );
  expect(after.rows[0]).toEqual({ status: "CANCELLED", paidCents: 0, paymentStatus: "REFUNDED" });
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 20, reserved: 0 });
});

test("an unused card payment link expires without cancelling the order", async ({
  page,
  request,
  sql,
}) => {
  const { order } = await placePickupOrder(page, sql, uniqueEmail("balance-link"));
  await sql.query(
    `INSERT INTO "Payment" (id, "orderId", method, "amountCents", status, "stripeSessionId", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'CARD', 20000, 'PENDING', $2, now())`,
    [order.id, `cs_test_balance_${order.id}`],
  );
  const payload = JSON.stringify({
    id: `evt_balance_${order.id}`,
    object: "event",
    type: "checkout.session.expired",
    api_version: "2026-03-25.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_balance_${order.id}`,
        object: "checkout.session",
        payment_status: "unpaid",
        metadata: { orderId: order.id, kind: "balance" },
      },
    },
  });
  const response = await request.post("/api/webhooks/stripe", {
    data: payload,
    headers: { "stripe-signature": stripeSignature(payload), "content-type": "application/json" },
  });
  expect(response.ok()).toBe(true);
  const { rows } = await sql.query(
    `SELECT o.status, p.status AS "paymentStatus" FROM "Order" o JOIN "Payment" p ON p."orderId" = o.id WHERE o.id = $1`,
    [order.id],
  );
  expect(rows[0]).toEqual({ status: "PLACED", paymentStatus: "CANCELLED" });
});

test("reports and the audit log load for a period", async ({ adminPage }) => {
  await adminPage.goto("/admin/reports");
  await expect(adminPage.getByRole("heading", { name: "Reports" })).toBeVisible();
  for (const panel of [
    "Received by payment method",
    "Orders placed (not cancelled)",
    "Top products",
    "Stock on hand now (at selling price)",
    "Deposits paid, balance owing",
  ]) {
    await expect(adminPage.getByRole("region", { name: panel })).toBeVisible();
  }
  await adminPage.getByRole("link", { name: "Last month" }).click();
  await expect(adminPage).toHaveURL(/from=\d{4}-\d{2}-01&to=/);

  await adminPage.getByRole("link", { name: "Audit log" }).click();
  await expect(adminPage.getByRole("heading", { name: "Audit log" })).toBeVisible();
});
