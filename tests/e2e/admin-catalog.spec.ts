import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type pg from "pg";

import { expect, test } from "./fixtures";
import { createProduct, placePickupOrder, uniqueEmail } from "./shop-helpers";

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

test("products are filtered like the inventory, without a page reload", async ({
  adminPage: page,
  sql,
}) => {
  // createProduct puts test products in the CPU cooler category, with no photos.
  const product = await createProduct(sql, { stockTOR: 0, stockMTL: 0 });
  await page.goto("/admin/products");
  await page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
  await expect(page.getByRole("button", { name: "Filter" })).toHaveCount(0);

  await page.getByLabel("Part", { exact: true }).selectOption("cooler");
  await expect(page).toHaveURL(/category=cooler/);
  // The part's specs get their own dropdowns.
  await expect(page.locator('select[name^="spec."]').first()).toBeVisible();

  await page.getByLabel("Search products").fill(product.sku);
  await expect(page).toHaveURL(new RegExp(`q=${product.sku}`));
  const row = page.getByRole("row", { name: new RegExp(product.sku) });
  await expect(row).toBeVisible();
  await page.getByLabel("Content", { exact: true }).selectOption("photos");
  await expect(page).toHaveURL(/missing=photos/);
  await page.getByLabel("Stock", { exact: true }).selectOption("out");
  await expect(page).toHaveURL(/stock=out/);
  await expect(row).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^1 product/ })).toBeVisible();

  await page.getByLabel("Status", { exact: true }).selectOption("DRAFT");
  await expect(row).toHaveCount(0);

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByLabel("Part", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Search products")).toHaveValue("");
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});

// A 1×1 PNG, for a product photo.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// A featured (prebuilt) build and a customer's build, both with the product.
async function addToBuilds(sql: pg.Client, productId: string, title: string) {
  const ids: string[] = [];
  for (const featured of [true, false]) {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO "Build" (id, "shareId", "editToken", featured, title, position, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 999, now())`,
      [
        id,
        `e2e-${id.slice(0, 12)}`,
        `e2e-${id}`,
        featured,
        featured ? JSON.stringify({ en: title, fr: title }) : null,
      ],
    );
    await sql.query(
      `INSERT INTO "BuildItem" ("buildId", slot, "productId") VALUES ($1, 'COOLER', $2)`,
      [id, productId],
    );
    ids.push(id);
  }
  return ids;
}

async function auditFor(sql: pg.Client, productId: string) {
  const { rows } = await sql.query<{ action: string; actorId: string | null; details: unknown }>(
    `SELECT action, "actorId", details FROM "AuditLog"
     WHERE "entityId" = $1 AND action IN ('product.delete', 'product.archive')`,
    [productId],
  );
  return rows;
}

test("a product that was never sold is deleted for good after confirming", async ({
  adminPage: page,
  sql,
}) => {
  const product = await createProduct(sql);
  const buildTitle = `E2E Prebuilt ${product.sku}`;
  const builds = await addToBuilds(sql, product.id, buildTitle);

  await page.goto(`/admin/products/${product.id}`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "fan.png",
    mimeType: "image/png",
    buffer: PIXEL_PNG,
  });
  await expect(page.getByText("Main", { exact: true })).toBeVisible();
  const { rows: images } = await sql.query<{ key: string }>(
    `SELECT key FROM "ProductImage" WHERE "productId" = $1`,
    [product.id],
  );
  const imageFile = path.resolve(".uploads", images[0].key);
  expect(existsSync(imageFile)).toBe(true);

  // The confirmation lists the prebuilt PC first. Escape cancels it.
  const danger = page.getByRole("region", { name: "Danger zone" });
  await danger.getByRole("button", { name: "Delete product" }).click();
  const dialog = page.getByRole("dialog", { name: `Delete ${product.name} (${product.sku})?` });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("p").first()).toHaveText(
    `It's part of this prebuilt PC: “${buildTitle}”. It will be removed from it, so pick a replacement part.`,
  );
  await expect(dialog).toContainText("It will also be removed from 1 customer build.");
  await expect(dialog).toContainText("This can't be undone.");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(danger.getByRole("button", { name: "Delete product" })).toBeFocused();

  // Keyboard only: open it again, tab to the confirm button and press Enter.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Delete product" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/admin/products\\?deleted=${product.sku}$`));
  await expect(page.getByRole("status").filter({ hasText: "Deleted" })).toHaveText(
    `Deleted ${product.sku}.`,
  );

  const gone = await sql.query(`SELECT 1 FROM "Product" WHERE id = $1`, [product.id]);
  expect(gone.rowCount).toBe(0);
  const items = await sql.query(`SELECT 1 FROM "BuildItem" WHERE "productId" = $1`, [product.id]);
  expect(items.rowCount).toBe(0);
  // The builds themselves stay, without the part.
  const kept = await sql.query(`SELECT 1 FROM "Build" WHERE id = ANY($1)`, [builds]);
  expect(kept.rowCount).toBe(2);
  expect(existsSync(imageFile)).toBe(false);

  const audit = await auditFor(sql, product.id);
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    action: "product.delete",
    details: { sku: product.sku, name: product.name, outcome: "deleted" },
  });
  expect(audit[0].actorId).toBeTruthy();
  await page.goto(`/admin/audit?q=${product.sku}`);
  await expect(page.getByText(`Deleted ${product.sku} (${product.name})`)).toBeVisible();

  await page.goto(`/en/p/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await page.goto(`/en/search?q=${product.sku}`);
  await expect(page.getByRole("status")).toHaveText(`No results for “${product.sku}”`);
});

test("a product that was sold or bought is archived instead, and past orders keep it", async ({
  adminPage: page,
  sql,
}) => {
  const { order, product } = await placePickupOrder(page, sql, uniqueEmail("archive"));
  await sql.query(
    `WITH p AS (
       INSERT INTO "Purchase" (id, "locationId", supplier, "purchasedAt")
       SELECT $1, id, 'E2E Supplier', now() FROM "Location" WHERE code = 'TOR' RETURNING id)
     INSERT INTO "PurchaseLine" (id, "purchaseId", "productId", quantity, "unitCostCents", "landedUnitCostCents")
     SELECT $2, id, $3, 1, 500, 500 FROM p`,
    [randomUUID(), randomUUID(), product.id],
  );
  const buildTitle = `E2E Prebuilt ${product.sku}`;
  await addToBuilds(sql, product.id, buildTitle);

  await page.goto(`/admin/products/${product.id}`);
  await page.getByRole("button", { name: "Delete product" }).click();
  const dialog = page.getByRole("dialog", { name: `Archive ${product.name} (${product.sku})?` });
  await expect(dialog.locator("p").first()).toContainText(buildTitle);
  await expect(dialog).toContainText(
    "This product appears in 1 order and 1 purchase, so it will be archived instead of deleted. " +
      "It disappears from the store and the builder, and past orders keep it.",
  );
  await dialog.getByRole("button", { name: "Archive product" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/products/${product.id}\\?archived=1$`));
  await expect(page.getByRole("status").filter({ hasText: "Archived instead" })).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("ARCHIVED");
  await expect(page.getByRole("region", { name: "Danger zone" })).toContainText(
    "It can't be deleted because past orders or purchases include it.",
  );

  const { rows } = await sql.query(`SELECT status FROM "Product" WHERE id = $1`, [product.id]);
  expect(rows[0].status).toBe("ARCHIVED");
  const items = await sql.query(`SELECT 1 FROM "BuildItem" WHERE "productId" = $1`, [product.id]);
  expect(items.rowCount).toBe(0);
  const audit = await auditFor(sql, product.id);
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    action: "product.archive",
    details: { sku: product.sku, outcome: "archived", orders: 1, purchases: 1 },
  });
  expect(audit[0].actorId).toBeTruthy();

  // The order still shows the product; the store doesn't.
  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByText(product.sku).first()).toBeVisible();
  await page.goto(`/en/p/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("archived products are hidden from the products list unless asked for", async ({
  adminPage: page,
  sql,
}) => {
  const product = await createProduct(sql);
  await sql.query(`UPDATE "Product" SET status = 'ARCHIVED' WHERE id = $1`, [product.id]);
  const row = page.getByRole("row", { name: new RegExp(product.sku) });

  await page.goto(`/admin/products?q=${product.sku}`);
  await expect(page.getByRole("status").filter({ hasText: /^0 products/ })).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Status", { exact: true }).locator("option")).toHaveText([
    "Active and drafts",
    "Active",
    "Draft",
    "Archived",
  ]);

  await page.getByLabel("Status", { exact: true }).selectOption("ARCHIVED");
  await expect(page).toHaveURL(/status=ARCHIVED/);
  await expect(row).toBeVisible();
  await expect(row).toContainText("archived");
});
