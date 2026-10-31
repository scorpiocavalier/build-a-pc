import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { fillContactAndWindow, orderFor, uniqueEmail } from "./shop-helpers";

// Uses the seeded catalog and its featured builds ("Astral Midnight" is all
// in stock in Toronto).

async function pick(page: Page, slot: string, name: string) {
  await page.goto(`/en/build/${slot}`);
  await page.getByRole("button", { name: `Select: ${name}` }).click();
  await expect(page).toHaveURL(/\/en\/build$/);
  await expect(page.getByRole("heading", { name: "Compatibility" })).toBeVisible();
}

const summary = (page: Page) => page.getByRole("complementary", { name: "Your build" });

test("the builder flags incompatible parts and blocks assembly until they're fixed", async ({
  page,
}) => {
  await pick(page, "cpu", "Core Ultra 7 265K");

  // The picker hides boards that don't fit, with the reason.
  await page.goto("/en/build/motherboard");
  await expect(page.getByRole("status").first()).toHaveText("1 compatible part");
  await page.getByText(/parts? doesn't fit your build|parts don't fit your build/).click();
  await expect(
    page.getByText("The processor uses LGA1851 but the motherboard is AM5.").first(),
  ).toBeVisible();

  // Choosing it anyway shows the problem and disables "Have us build it".
  await page.getByRole("button", { name: "Select: B850 Aorus Elite WiFi7 Ice" }).click();
  await expect(
    summary(page).getByText("The processor uses LGA1851 but the motherboard is AM5."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Have us build it/ })).toBeDisabled();

  await pick(page, "cpu", "Ryzen 5 9600X");
  await expect(summary(page).getByText("The processor uses LGA1851")).toHaveCount(0);
  await expect(
    summary(page).getByText(
      /To have us build it, add: Memory, Storage, Case, Power supply, CPU cooler/,
    ),
  ).toBeVisible();
});

test("a shared build is read-only and can be copied into your own builder", async ({
  page,
  browser,
}) => {
  await page.goto("/en/prebuilt");
  await page.getByRole("link", { name: /Astral Midnight/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Astral Midnight");
  await expect(page.getByText("Everything you've picked is compatible.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Change|Remove/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Customize this build" }).click();
  await expect(page).toHaveURL(/\/en\/build$/);
  await expect(page.getByRole("link", { name: "AMD Ryzen 7 9800X3D" })).toBeVisible();

  // Someone else opening the share link can't change it.
  const shareUrl = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  const other = await browser.newPage();
  await other.goto(new URL(shareUrl).pathname);
  await expect(other.getByRole("button", { name: "Customize this build" })).toBeVisible();
  await expect(other.getByRole("link", { name: /Change/ })).toHaveCount(0);
});

test("an assembled PC goes through checkout with a deposit, assembly and pickup", async ({
  adminPage,
  browser,
  isMobile,
  sql,
}) => {
  test.skip(isMobile, "order tests run once, on desktop");
  const email = uniqueEmail("assembled");
  const customer = await browser.newPage();

  // Make sure Toronto has free stock for every part (and Windows), whatever
  // earlier runs left reserved.
  await sql.query(
    `UPDATE "Inventory" i SET "onHand" = i.reserved + 10
     FROM "Location" l
     WHERE l.id = i."locationId" AND l.code = 'TOR' AND i."productId" IN (
       SELECT "productId" FROM "BuildItem" bi JOIN "Build" b ON b.id = bi."buildId"
       WHERE b."shareId" = 'astral-midnight'
       UNION SELECT id FROM "Product" WHERE sku = 'WIN11-HOME')`,
  );

  await customer.goto("/en/build/s/astral-midnight");
  await customer.getByRole("button", { name: "Customize this build" }).click();
  await customer.getByRole("button", { name: /Have us build it/ }).click();
  await expect(customer.getByText("Your build was added to the cart.")).toBeVisible();

  await customer.goto("/en/cart");
  await expect(customer.getByRole("heading", { name: "Assembled PC" })).toBeVisible();
  await expect(customer.getByText("Windows 11 Home (OEM licence)")).toBeVisible();

  await customer.goto("/en/checkout?f=pickup&l=TOR");
  const summaryBox = customer.getByRole("complementary", { name: "Order summary" });
  await expect(summaryBox.getByText("Assembly and testing")).toBeVisible();
  await expect(customer.getByText(/Deposit due now: \$[\d,.]+ \(30%\)/)).toBeVisible();
  await fillContactAndWindow(customer, email);
  await customer.getByRole("radio", { name: /Cash/ }).check();
  await customer.getByRole("button", { name: "Place order" }).click();
  await expect(customer.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();

  const order = await orderFor(sql, email);
  const { rows } = await sql.query(
    `SELECT "assemblyCents", "depositCents", "totalCents" FROM "Order" WHERE id = $1`,
    [order.id],
  );
  expect(rows[0].assemblyCents).toBe(14999);
  expect(rows[0].depositCents).toBe(Math.ceil(rows[0].totalCents * 0.3));

  // Admin: can't confirm before the deposit; recording it confirms the order.
  await adminPage.goto(`/admin/orders/${order.id}`);
  await expect(adminPage.getByText(/Waiting for the \$[\d,.]+ deposit/)).toBeVisible();
  await expect(adminPage.getByRole("button", { name: "Confirm order" })).toHaveCount(0);

  await adminPage.locator("#pay-method").selectOption("ETRANSFER");
  await adminPage.locator("#pay-amount").fill((rows[0].depositCents / 100).toFixed(2));
  await adminPage.getByRole("button", { name: "Record payment" }).click();
  await expect(adminPage.getByRole("button", { name: "Start assembly" })).toBeVisible();

  await adminPage.getByRole("link", { name: "Build sheet" }).click();
  await expect(adminPage.getByText("PC 1 of 1")).toBeVisible();
  await expect(adminPage.getByRole("cell", { name: "Processor" })).toBeVisible();
  await expect(adminPage.getByRole("cell", { name: "WIN11-HOME" })).toBeVisible();
  await adminPage.goBack();

  await adminPage.getByRole("button", { name: "Start assembly" }).click();
  await adminPage.getByRole("button", { name: "Mark ready" }).click();
  await adminPage.locator("#pay-method").selectOption("CASH");
  await adminPage.getByRole("button", { name: "Record payment" }).click();
  await adminPage.getByRole("button", { name: /Mark completed/ }).click();
  await expect(
    adminPage.getByRole("heading", { level: 1 }).filter({ hasText: "completed" }),
  ).toBeVisible();

  // Windows came out of Toronto's stock along with the parts.
  const sales = await sql.query(
    `SELECT count(*)::int AS n FROM "InventoryMovement" m JOIN "Product" p ON p.id = m."productId"
     WHERE m.reason = 'SALE' AND m.note = $1`,
    [`Order ${order.number}`],
  );
  expect(sales.rows[0].n).toBe(9); // 8 parts + Windows
});
