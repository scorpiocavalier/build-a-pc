import { expect, test } from "@playwright/test";

// The store page (/locations) was removed when the site went to one store
// (#52). Old links and search results land on the home page in the same
// language.

for (const [from, to] of [
  ["/en/locations", "/en"],
  ["/fr/locations", "/fr"],
  ["/locations", "/"],
]) {
  test(`${from} redirects permanently to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(to);
  });
}

test("old store page links open the home page in English", async ({ page }) => {
  for (const from of ["/locations", "/en/locations"]) {
    await page.goto(from);
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
  }
});

test("old store page links open the home page in French", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-CA" });
  const page = await context.newPage();
  for (const from of ["/locations", "/fr/locations"]) {
    await page.goto(from);
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  }
  await context.close();
});
