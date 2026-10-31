import { expect, test } from "@playwright/test";

// Runs against the seeded placeholder catalog (npm run db:seed).

test("shop page lists the eight categories", async ({ page }) => {
  await page.goto("/en/shop");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shop PC parts");
  for (const name of ["Processors (CPU)", "Graphics cards", "Power supplies", "CPU coolers"]) {
    await expect(
      page.getByRole("link", { name: new RegExp(name.replace(/[()]/g, "\\$&")) }),
    ).toBeVisible();
  }
});

test("category filters narrow the product list and can be cleared", async ({ page, isMobile }) => {
  await page.goto("/en/c/cpu");
  await expect(page.getByRole("status").first()).toHaveText("3 products");

  if (isMobile) await page.getByText("Filters", { exact: true }).click();
  const filters = isMobile
    ? page.locator("details")
    : page.getByRole("complementary", { name: "Filters" });
  await filters.getByRole("link", { name: /^LGA1851/ }).click();

  await expect(page).toHaveURL(/socket=LGA1851/);
  await expect(page.getByRole("status").first()).toHaveText("1 product");
  await expect(page.getByRole("heading", { name: "Core Ultra 7 265K" })).toBeVisible();

  await filters.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("status").first()).toHaveText("3 products");
});

test("product page shows French specs, stock per location and structured data", async ({
  page,
}) => {
  await page.goto("/fr/p/gigabyte-geforce-rtx-5080-aero-oc-16g");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GeForce RTX 5080 Aero OC 16G");
  await expect(page.getByText("1 599,99 $")).toBeVisible();
  await expect(page.getByText("Montréal : 1 en stock")).toBeVisible();

  const specs = page.locator("dl");
  await expect(specs).toContainText("Mémoire vidéo");
  await expect(specs).toContainText(/16\sGo/);
  await expect(specs).toContainText("Blanc");

  const jsonLd = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
  );
  expect(jsonLd).toMatchObject({
    "@type": "Product",
    offers: { price: "1599.99", priceCurrency: "CAD" },
  });
});

test("search finds products by partial model number", async ({ page }) => {
  await page.goto("/en/search?q=9800");
  await expect(page.getByRole("status")).toHaveText("1 result for “9800”");
  await expect(page.getByRole("heading", { name: "Ryzen 7 9800X3D" })).toBeVisible();
});

test("search in French matches French names", async ({ page }) => {
  await page.goto("/fr/search?q=disque%20dur");
  await expect(page.getByRole("heading", { name: "Disque dur BarraCuda 4 To" })).toBeVisible();
});

// The page shell streams before the product lookup finishes, so the HTTP
// status is 200; Next.js marks the result noindex so search engines skip it.
test("unknown products and categories show a not-found page", async ({ page }) => {
  for (const url of ["/en/p/not-a-product", "/en/c/toasters"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
  }
});
