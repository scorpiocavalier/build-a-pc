import { writeFile } from "node:fs/promises";

import { expect, test } from "./fixtures";

// These tests change data, so they only run in one browser project and use
// unique SKUs per run.
test.skip(({ isMobile }) => isMobile, "admin data tests run once, on desktop");

const uniqueSku = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

test("an admin creates a product and it appears on the store", async ({ adminPage: page }) => {
  const sku = uniqueSku("E2E-PSU");
  await page.goto("/admin/products/new");
  await page.getByRole("link", { name: "Power supplies" }).click();

  await page.getByLabel("Name (English)").fill(`Test PSU ${sku}`);
  await page.getByLabel("Name (French)").fill(`Bloc d’essai ${sku}`);
  await page.getByLabel("Brand").fill("E2E Brand");
  await page.getByLabel("Status").selectOption("ACTIVE");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Price (CAD)", { exact: true }).fill("99.50");
  await page.getByLabel("Stock on hand: Montreal").fill("7");

  // Submitting without required specs shows errors and keeps what was typed.
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Please fix the errors below.")).toBeVisible();
  await expect(page.getByText("Wattage is required")).toBeVisible();
  await expect(page.getByLabel("SKU")).toHaveValue(sku);

  await page.getByLabel("Wattage (W)").fill("650");
  await page.getByLabel("Form factor").selectOption("ATX");
  await page.getByRole("checkbox", { name: "8-pin" }).check();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(`/fr/search?q=${sku}`);
  await page.getByRole("link", { name: `Bloc d’essai ${sku}` }).click();
  await expect(page.getByText("99,50 $", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Montréal : 7 en stock")).toBeVisible();
  await expect(page.getByText("Toronto : rupture de stock")).toBeVisible();
});

test("CSV import checks every row before importing anything", async ({
  adminPage: page,
  sql,
}, testInfo) => {
  const good = uniqueSku("E2E-RAM");
  const header =
    "sku,category,brand,name_en,name_fr,price,status,stock_TOR,spec.type,spec.modules,spec.capacityPerModuleGb,spec.speedMts";
  const goodRow = `${good},memory,E2E Brand,Test RAM ${good},Mémoire d’essai ${good},89.99,ACTIVE,5,DDR5,2,16,6000`;
  const badRow = `${good}-BAD,memory,E2E Brand,Bad RAM,,cheap,ACTIVE,,DDR3,2,16,6000`;

  const badFile = testInfo.outputPath("bad.csv");
  await writeFile(badFile, [header, goodRow, badRow].join("\n"));
  const goodFile = testInfo.outputPath("good.csv");
  await writeFile(goodFile, [header, goodRow].join("\n"));

  await page.goto("/admin/import");
  await page.locator('input[type="file"]').setInputFiles(badFile);
  await page.getByRole("button", { name: "Check file" }).click();
  await expect(page.getByRole("status")).toContainText("1 of 2 rows have problems");
  await expect(page.getByText("Price must be an amount like 549.99")).toBeVisible();
  await expect(page.getByText(/Type must be one of: DDR5, DDR4/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import/ })).toHaveCount(0);
  const before = await sql.query(`SELECT 1 FROM "Product" WHERE sku = $1`, [good]);
  expect(before.rowCount).toBe(0);

  await page.locator('input[type="file"]').setInputFiles(goodFile);
  await page.getByRole("button", { name: "Check file" }).click();
  await expect(page.getByRole("status")).toContainText("looks good: 1 new, 0 updated");
  await page.getByRole("button", { name: "Import 1 products" }).click();
  await expect(page.getByRole("status")).toContainText("1 created, 0 updated");

  const movements = await sql.query(
    `SELECT m.delta, m.reason FROM "InventoryMovement" m
     JOIN "Product" p ON p.id = m."productId" WHERE p.sku = $1`,
    [good],
  );
  expect(movements.rows).toEqual([{ delta: 5, reason: "IMPORT" }]);

  await page.goto(`/en/search?q=${good}`);
  await expect(page.getByRole("heading", { name: `Test RAM ${good}` })).toBeVisible();
});

test("templates download with the category's spec columns", async ({ adminPage: page }) => {
  const response = await page.request.get("/admin/import/csv/cooler");
  expect(response.headers()["content-type"]).toContain("text/csv");
  const text = await response.text();
  expect(text.split("\r\n")[0]).toContain("spec.radiatorMm");
});

test("a signed-in customer who isn't an admin is turned away", async ({ signInAs }) => {
  const page = await signInAs(`customer-${Date.now()}@example.com`);
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/sign-in\?error=AccessDenied$/);
  await expect(page.getByText("isn't allowed into the admin")).toBeVisible();

  const download = await page.request.get("/admin/import/csv/cpu", { maxRedirects: 0 });
  expect(download.status()).toBe(307);
});
