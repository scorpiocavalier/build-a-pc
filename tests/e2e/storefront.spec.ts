import { expect, test } from "@playwright/test";

test("redirects / to the English home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Custom gaming PCs, built by hand.",
  );
});

test("sends French browsers to the French home page", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-CA" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  await context.close();
});

test("switches between English and French", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Afficher le site en français" }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Des PC de jeu sur mesure, assemblés à la main.",
  );

  await page.getByRole("link", { name: "View the site in English" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("shows the build gallery and both pickup locations", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#builds img")).toHaveCount(5);
  await expect(page.locator("#locations")).toContainText("Toronto, Ontario");
  await expect(page.locator("#locations")).toContainText("Montreal, Quebec");
});

test("shows a localized not-found page", async ({ page }) => {
  const response = await page.goto("/fr/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
});
