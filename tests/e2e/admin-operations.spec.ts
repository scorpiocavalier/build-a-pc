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
    "Stock on hand now",
    "Gross profit (orders handed over in this period)",
    "Deposits paid, balance owing",
  ]) {
    await expect(adminPage.getByRole("region", { name: panel })).toBeVisible();
  }
  await adminPage.getByRole("link", { name: "Last month" }).click();
  await expect(adminPage).toHaveURL(/from=\d{4}-\d{2}-01&to=/);

  await adminPage.getByRole("link", { name: "Audit log" }).click();
  await expect(adminPage.getByRole("heading", { name: "Audit log" })).toBeVisible();
});

test("inventory filters apply as you type and pick", async ({ adminPage, sql }) => {
  // createProduct puts test products in the CPU cooler category.
  const product = await createProduct(sql, { stockTOR: 0, stockMTL: 3 });
  const page = adminPage;
  await page.goto("/admin/inventory");
  // Set on the window: a full page reload would wipe it.
  await page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
  await expect(page.getByRole("button", { name: "Filter" })).toHaveCount(0);

  // The search applies after a pause in typing; no button or Enter needed.
  await page.getByLabel("Search stock").fill(product.sku);
  await expect(page).toHaveURL(new RegExp(`q=${product.sku}`));
  const row = page.getByRole("row", { name: new RegExp(product.sku) });
  await expect(row).toBeVisible();
  await expect(page.getByLabel("Search stock")).toHaveValue(product.sku);

  await page.getByLabel("Part", { exact: true }).selectOption("cooler");
  await expect(page).toHaveURL(/category=cooler/);
  await page.locator("#filter-location").selectOption("TOR");
  await expect(page).toHaveURL(/location=TOR/);
  await page.getByLabel("Stock", { exact: true }).selectOption("out");
  await expect(page).toHaveURL(/stock=out/);
  await expect(row).toBeVisible();

  // In stock in Toronto: it has none there.
  await page.getByLabel("Stock", { exact: true }).selectOption("in");
  await expect(row).toHaveCount(0);

  // Montreal has 3.
  await page.locator("#filter-location").selectOption("MTL");
  await expect(row).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^1 product$/ })).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/admin\/inventory$/);
  await expect(page.locator("#filter-location")).toHaveValue("all");
  await expect(page.getByLabel("Part", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Search stock")).toHaveValue("");
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});

test("inventory can be filtered by a part's specs", async ({ adminPage: page }) => {
  await page.goto("/admin/inventory");
  await expect(page.getByLabel("Socket", { exact: true })).toHaveCount(0);

  await page.getByLabel("Part", { exact: true }).selectOption("motherboard");
  const socket = page.getByLabel("Socket", { exact: true });
  await expect(socket).toBeVisible();

  const option = socket.locator("option").nth(1);
  const value = (await option.getAttribute("value"))!;
  const count = Number((await option.textContent())!.match(/\((\d+)\)$/)![1]);
  await socket.selectOption(value);
  await expect(page).toHaveURL(new RegExp(`spec\\.socket=${value}`));
  await expect(
    page.getByRole("status").filter({ hasText: new RegExp(`^${count} products?`) }),
  ).toBeVisible();
});

test("purchases keep a weighted average cost per location", async ({ adminPage, sql }) => {
  const product = await createProduct(sql, { stockTOR: 2, stockMTL: 0, priceCents: 1500 });
  const page = adminPage;
  const avg = async (code: "TOR" | "MTL") => {
    const { rows } = await sql.query<{ avgCostCents: number | null }>(
      `SELECT i."avgCostCents" FROM "Inventory" i JOIN "Location" l ON l.id = i."locationId"
       WHERE i."productId" = $1 AND l.code = $2`,
      [product.id, code],
    );
    return rows[0]?.avgCostCents ?? null;
  };

  // The 2 units already in Toronto cost $10.
  await page.goto("/admin/purchases");
  const setCost = page.getByRole("region", { name: "Set average cost" });
  await setCost.getByLabel("SKU").fill(product.sku);
  await setCost.getByLabel("Cost per unit").fill("10.00");
  await setCost.getByRole("button", { name: "Set cost" }).click();
  await expect(setCost.getByText("Saved.")).toBeVisible();
  expect(await avg("TOR")).toBe(1000);

  // 10 more at $12 into Toronto: (2 × 10 + 10 × 12) / 12 = $11.67.
  const receive = page.getByRole("region", { name: "Receive stock" });
  await receive.getByLabel("Supplier").fill("Test Distributor");
  await receive.getByLabel("SKU, line 1").fill(product.sku);
  await receive.getByLabel("Units, line 1").fill("10");
  await receive.getByLabel("Unit cost, line 1").fill("12.00");
  await receive.getByRole("button", { name: "Receive stock" }).click();
  await expect(receive.getByText(/Received as PO-\d+\./)).toBeVisible();
  expect(await avg("TOR")).toBeCloseTo(1166.67, 2);
  expect(await stock(sql, product.id, "TOR")).toEqual({ onHand: 12, reserved: 0 });
  const firstPo = (await receive.getByRole("status").textContent())!;

  // Montreal: 4 at $20 plus $8 shipping = $22 landed, its own average.
  await receive.getByLabel("Received at").selectOption("MTL");
  await receive.getByLabel("Supplier").fill("Test Distributor");
  await receive.getByLabel("SKU, line 1").fill(product.sku);
  await receive.getByLabel("Units, line 1").fill("4");
  await receive.getByLabel("Unit cost, line 1").fill("20.00");
  await receive.getByLabel("Shipping").fill("8.00");
  await expect(receive.getByLabel("Landed cost per unit, line 1")).toHaveText("$22.00");
  await receive.getByRole("button", { name: "Receive stock" }).click();
  await expect(receive.getByRole("status")).toHaveText(/Received as PO-\d+\./);
  await expect(receive.getByRole("status")).not.toHaveText(firstPo);
  expect(await avg("MTL")).toBeCloseTo(2200, 2);
  expect(await avg("TOR")).toBeCloseTo(1166.67, 2);
  await expect(page.getByText("Test Distributor").first()).toBeVisible();

  // The inventory shows each store's cost and margin. Montreal's $22 cost on
  // a $15 price is a negative margin, so it needs a price review.
  await page.goto(`/admin/inventory?q=${product.sku}&cost=review`);
  const row = page.getByRole("row", { name: new RegExp(product.sku) });
  await expect(row).toContainText("$11.67 · 22%");
  await expect(row).toContainText("$22.00 · -47%");
  await page.locator("#filter-location").selectOption("TOR");
  await expect(row).toHaveCount(0);

  // The products list shows the same cost and margin per store.
  await page.goto(`/admin/products?q=${product.sku}`);
  const productRow = page.getByRole("row", { name: new RegExp(product.sku) });
  await expect(productRow).toContainText("$11.67 · 22%");
  await expect(productRow).toContainText("$22.00 · -47%");

  // Moved units carry the sending store's cost: (12 × 11.67 + 2 × 22) / 14.
  await page.goto("/admin/inventory");
  const move = page.getByRole("region", { name: "Move stock" });
  await move.getByLabel("SKU").fill(product.sku);
  await move.getByLabel("Units").fill("2");
  await move.getByLabel("From").selectOption("MTL");
  await move.getByLabel("To").selectOption("TOR");
  await move.getByRole("button", { name: "Move stock" }).click();
  await expect(move.getByText("Saved.")).toBeVisible();
  expect(await avg("TOR")).toBeCloseTo(1314.29, 2);
  expect(await avg("MTL")).toBeCloseTo(2200, 2);
});
