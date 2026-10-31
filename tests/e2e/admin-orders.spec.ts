import { expect, test } from "./fixtures";
import {
  addToCart,
  createProduct,
  fillContactAndWindow,
  orderFor,
  stock,
  uniqueEmail,
} from "./shop-helpers";

test.skip(({ isMobile }) => isMobile, "admin data tests run once, on desktop");

test("an admin takes a cash order from confirmation to pickup", async ({
  adminPage,
  browser,
  sql,
}) => {
  const product = await createProduct(sql, { priceCents: 5000 });
  const email = uniqueEmail("admin-cash");

  // A customer in a separate browser places a cash order.
  const customer = await browser.newPage();
  await addToCart(customer, product.slug, "en", 3);
  // Montreal, so the tax test toggling Ontario HST in parallel can't change the total.
  await customer.goto("/en/checkout?f=pickup&l=MTL");
  await fillContactAndWindow(customer, email);
  await customer.getByRole("radio", { name: /Cash/ }).check();
  await customer.getByRole("button", { name: "Place order" }).click();
  await expect(customer.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();
  const order = await orderFor(sql, email);

  const page = adminPage;
  await page.goto(`/admin/orders?q=${encodeURIComponent(email)}`);
  await page.getByRole("link", { name: /^ATG-/ }).click();
  await expect(page.getByText(/Cancels automatically if unpaid/)).toBeVisible();

  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByRole("button", { name: "Mark ready" })).toBeVisible();
  await expect(page.getByText(/Cancels automatically/)).toHaveCount(0);
  await page.getByRole("button", { name: "Mark ready" }).click();

  // Can't hand over before it's paid.
  await expect(
    page.getByText("Record the full payment before marking it completed."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Mark completed/ })).toHaveCount(0);

  await page.locator("#pay-method").selectOption("CASH");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/cash · \$150\.00 · succeeded/)).toBeVisible();
  await page.getByRole("button", { name: /Mark completed/ }).click();
  await expect(
    page.getByRole("heading", { level: 1 }).filter({ hasText: "completed" }),
  ).toBeVisible();

  // Stock is deducted on handover and the reservation cleared.
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 17, reserved: 0 });
  const movements = await sql.query(
    `SELECT delta, reason FROM "InventoryMovement" WHERE "productId" = $1`,
    [product.id],
  );
  expect(movements.rows).toEqual([{ delta: -3, reason: "SALE" }]);

  await customer.goto(`/en/orders/${order.id}?t=${order.accessToken}`);
  await expect(customer.getByText("Completed", { exact: true })).toBeVisible();
});

test("cancelling an order releases its stock", async ({ adminPage: page, browser, sql }) => {
  const product = await createProduct(sql);
  const email = uniqueEmail("admin-cancel");
  const customer = await browser.newPage();
  await addToCart(customer, product.slug, "en", 2);
  await customer.goto("/en/checkout?f=pickup&l=MTL");
  await fillContactAndWindow(customer, email);
  await customer.getByRole("button", { name: "Place order" }).click();
  await expect(customer.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 20, reserved: 2 });

  const order = await orderFor(sql, email);
  await page.goto(`/admin/orders/${order.id}`);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText(/Give a reason/)).toBeVisible();
  await page.getByLabel("Reason (sent to the customer)").fill("Customer asked to cancel");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("Cancelled: Customer asked to cancel")).toBeVisible();
  expect(await stock(sql, product.id, "MTL")).toEqual({ onHand: 20, reserved: 0 });
});

test("settings control delivery areas and tax", async ({ adminPage: page, sql }) => {
  await page.goto("/admin/settings");
  // Turn on Ontario HST, then check a Toronto pickup quote includes it.
  const ontario = page.locator("form").filter({ hasText: "Collect in ON" });
  await ontario.getByLabel("Collect in ON").check();
  await ontario.getByRole("button", { name: "Save ON" }).click();
  await expect(ontario.getByText("Saved.")).toBeVisible();

  try {
    const product = await createProduct(sql, { priceCents: 10000 });
    await addToCart(page, product.slug);
    await page.goto("/en/checkout?f=pickup&l=TOR");
    const summary = page.getByRole("complementary", { name: "Order summary" });
    await expect(summary.getByText("HST (13 %)")).toBeVisible();
    await expect(summary.getByText("$113.00")).toBeVisible();
  } finally {
    await sql.query(`UPDATE "TaxRate" SET collect = false WHERE province = 'ON'`);
  }
});
