import { expect, test } from "./fixtures";
import { addToCart, createProduct } from "./shop-helpers";

// Switching Ontario tax collection on changes every order's total, so this
// file runs on its own after the other tests (the "tax" project in
// playwright.config.ts).

test("settings turn tax collection on for checkout", async ({ adminPage: page, sql }) => {
  await page.goto("/admin/settings");
  // Turn on Ontario HST, then check a pickup quote includes it.
  const ontario = page.locator("form").filter({ hasText: "Collect in ON" });
  await ontario.getByLabel("Collect in ON").check();
  await ontario.getByRole("button", { name: "Save ON" }).click();
  await expect(ontario.getByText("Saved.")).toBeVisible();

  try {
    const product = await createProduct(sql, { priceCents: 10000 });
    await addToCart(page, product.slug);
    await page.goto("/en/checkout?f=pickup");
    const summary = page.getByRole("complementary", { name: "Order summary" });
    await expect(summary.getByText("HST (13 %)")).toBeVisible();
    await expect(summary.getByText("$113.00")).toBeVisible();
  } finally {
    await sql.query(`UPDATE "TaxRate" SET collect = false WHERE province = 'ON'`);
  }
});
