import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { fillContactAndWindow, latestEmailTo, orderFor, uniqueEmail } from "./shop-helpers";

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
  await expect(
    page.getByRole("link", { name: /Astral Midnight/ }).getByText("Windows 11 Pro included"),
  ).toBeVisible();
  await page.getByRole("link", { name: /Astral Midnight/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Astral Midnight");
  await expect(page.getByText("Everything you've picked is compatible.")).toBeVisible();
  // The price is the parts: Windows 11 Pro and assembly cost nothing extra.
  await expect(summary(page).getByText("Windows 11 Pro included")).toBeVisible();
  await expect(summary(page).getByText(/Assembly|Windows 11 Home/)).toHaveCount(0);
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

  // Make sure Toronto has free stock for every part, whatever earlier runs
  // left reserved.
  await sql.query(
    `UPDATE "Inventory" i SET "onHand" = i.reserved + 10
     FROM "Location" l
     WHERE l.id = i."locationId" AND l.code = 'TOR' AND i."productId" IN (
       SELECT "productId" FROM "BuildItem" bi JOIN "Build" b ON b.id = bi."buildId"
       WHERE b."shareId" = 'astral-midnight')`,
  );

  await customer.goto("/en/build/s/astral-midnight");
  await customer.getByRole("button", { name: "Customize this build" }).click();
  // The assembled price is the parts total, with nothing added.
  const parts = await summary(customer)
    .locator("div", { has: customer.getByText("Parts", { exact: true }) })
    .locator("dd")
    .innerText();
  await expect(summary(customer).getByText("Windows 11 Pro included")).toBeVisible();
  await customer.getByRole("button", { name: `Have us build it · ${parts}` }).click();
  await expect(customer.getByText("Your build was added to the cart.")).toBeVisible();

  await customer.goto("/en/cart");
  const build = customer.locator("section", {
    has: customer.getByRole("heading", { name: "Assembled PC" }),
  });
  await expect(build.getByText("Windows 11 Pro included")).toBeVisible();
  await expect(build.getByText(parts, { exact: true })).toBeVisible();
  await expect(customer.getByText(/Assembly and testing|Windows 11 Home/)).toHaveCount(0);

  await customer.goto("/en/checkout?f=pickup&l=TOR");
  const summaryBox = customer.getByRole("complementary", { name: "Order summary" });
  await expect(summaryBox.getByText("Windows 11 Pro included")).toBeVisible();
  await expect(summaryBox.getByText(/Assembly|Windows 11 Home/)).toHaveCount(0);
  await expect(customer.getByText(/Deposit due now: \$[\d,.]+ \(30%\)/)).toBeVisible();
  await fillContactAndWindow(customer, email);
  await customer.getByRole("radio", { name: /Cash/ }).check();
  await customer.getByRole("button", { name: "Place order" }).click();
  await expect(customer.getByRole("heading", { name: "Thank you, Alex!" })).toBeVisible();
  await expect(customer.getByText("Windows 11 Pro included")).toBeVisible();
  await expect(customer.getByText(/Assembly and testing|Windows 11 Home/)).toHaveCount(0);

  const order = await orderFor(sql, email);
  const { rows } = await sql.query(
    `SELECT "assemblyCents", "depositCents", "subtotalCents", "deliveryCents", "taxCents",
            "totalCents", (SELECT count(*)::int FROM "OrderLine" WHERE "orderId" = o.id) AS lines
     FROM "Order" o WHERE id = $1`,
    [order.id],
  );
  // No assembly fee and no Windows line: the 8 parts are the whole order.
  expect(rows[0].assemblyCents).toBe(0);
  expect(rows[0].lines).toBe(8);
  expect(
    `$${(rows[0].subtotalCents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`,
  ).toBe(parts);
  expect(rows[0].totalCents).toBe(rows[0].subtotalCents + rows[0].deliveryCents + rows[0].taxCents);
  expect(rows[0].depositCents).toBe(Math.ceil(rows[0].totalCents * 0.3));

  const received = await latestEmailTo(email);
  expect(received.text).toContain("Windows 11 Pro included");
  expect(received.text).not.toMatch(/Assembly and testing|Windows 11 Home/);

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
  await expect(
    adminPage.getByText("Windows 11 Pro installed, updated and activated"),
  ).toBeVisible();
  await expect(adminPage.getByRole("cell", { name: "Software" })).toHaveCount(0);
  await adminPage.goBack();

  await adminPage.getByRole("button", { name: "Start assembly" }).click();
  await adminPage.getByRole("button", { name: "Mark ready" }).click();
  await adminPage.locator("#pay-method").selectOption("CASH");
  await adminPage.getByRole("button", { name: "Record payment" }).click();
  await adminPage.getByRole("button", { name: /Mark completed/ }).click();
  await expect(
    adminPage.getByRole("heading", { level: 1 }).filter({ hasText: "completed" }),
  ).toBeVisible();

  // Only the parts came out of Toronto's stock: there's no licence product.
  const sales = await sql.query(
    `SELECT count(*)::int AS n FROM "InventoryMovement" m JOIN "Product" p ON p.id = m."productId"
     WHERE m.reason = 'SALE' AND m.note = $1`,
    [`Order ${order.number}`],
  );
  expect(sales.rows[0].n).toBe(8);
});

test("assembled PCs show Windows 11 Pro included in French", async ({ page }) => {
  await page.goto("/fr/prebuilt");
  await expect(page.getByText("Windows 11 Pro inclus").first()).toBeVisible();
  await page.goto("/fr/build/s/astral-midnight");
  await expect(
    page.getByRole("complementary", { name: "Votre montage" }).getByText("Windows 11 Pro inclus"),
  ).toBeVisible();
  await expect(page.getByText(/Assemblage|Windows 11 Famille/)).toHaveCount(0);
});

test("an order placed with the old assembly fee still shows the fee and its Windows line", async ({
  page,
  isMobile,
  sql,
}) => {
  test.skip(isMobile, "order tests run once, on desktop");
  // An order as it was sold before assembly became free: $500 of parts,
  // a $159.99 Windows line, a $149.99 fee and 13% HST on all of it.
  const { rows } = await sql.query(
    `INSERT INTO "Order" (id, "accessToken", locale, name, email, phone, fulfilment, "locationId",
       "requestedWindow", "paymentMethod", "subtotalCents", "deliveryCents", "assemblyCents",
       "taxCents", "totalCents", "taxBreakdown")
     SELECT gen_random_uuid()::text, md5(random()::text), 'en', 'Old Order', $1, '514 555 0199',
       'PICKUP', id, '{"date":"2026-01-05","slot":"afternoon"}', 'CASH', 65999, 0, 14999,
       10530, 91528, '[{"name":"HST","rate":13000,"cents":10530}]'
     FROM "Location" WHERE code = 'TOR'
     RETURNING id, "accessToken"`,
    [uniqueEmail("old-assembled")],
  );
  const [old] = rows;
  await sql.query(
    `INSERT INTO "OrderLine" (id, "orderId", "productId", sku, name, "unitPriceCents", quantity, "buildGroup", slot)
     SELECT gen_random_uuid()::text, $1, p.id, p.sku, p.name, v.price, 1, 'pc1', v.slot::"BuildSlot"
     FROM (VALUES ('CPU-AMD-9800X3D', 50000, 'CPU'), ('WIN11-PRO', 15999, NULL)) AS v(sku, price, slot)
     JOIN "Product" p ON p.sku = v.sku`,
    [old.id],
  );

  await page.goto(`/en/orders/${old.id}?t=${old.accessToken}`);
  await expect(page.getByText("Assembly and testing")).toBeVisible();
  await expect(page.getByText("$149.99")).toBeVisible();
  await expect(page.getByText("$915.28")).toBeVisible();
  await expect(page.getByText("Windows 11 Pro (OEM licence)")).toBeVisible();
  // It paid for its licence, so it doesn't claim Windows was included free.
  await expect(page.getByText("Windows 11 Pro included")).toHaveCount(0);
});
