import { expect, test } from "@playwright/test";

// Runs against the seeded placeholder catalog (npm run db:seed).

test("product page shows French specs, stock and structured data", async ({ page }) => {
  await page.goto("/fr/p/gigabyte-geforce-rtx-5080-aero-oc-16g");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GeForce RTX 5080 Aero OC 16G");
  await expect(page.getByText("1 599,99 $")).toBeVisible();
  await expect(page.getByText("1 en stock", { exact: true })).toBeVisible();
  // The parts shop is gone (#34), so the breadcrumb is just Accueil › product.
  const crumbs = page.getByRole("navigation", { name: "Fil d’Ariane" }).getByRole("listitem");
  await expect(crumbs).toHaveText(["Accueil", /GeForce RTX 5080 Aero OC 16G$/]);

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
test("unknown products show a not-found page", async ({ page }) => {
  await page.goto("/en/p/not-a-product");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
});

test("product cards in a row are all the same size", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Two Ryzen CPUs in the seed: one row of search results.
  await page.goto("/en/search?q=ryzen");
  const cards = page.locator("main ul article");
  await expect(cards).toHaveCount(2);
  const sizes = await cards.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
  );
  expect(new Set(sizes).size).toBe(1);
});
