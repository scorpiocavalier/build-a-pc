import { expect, test, type Page } from "@playwright/test";

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

// On phones the language switch is in the menu.
async function openMenuOnMobile(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "Menu", exact: true }).click();
}

test("switches between English and French", async ({ page, isMobile }) => {
  await page.goto("/en");
  await openMenuOnMobile(page, isMobile);
  await page.getByRole("link", { name: "Afficher le site en français" }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Des PC de jeu sur mesure, assemblés à la main.",
  );

  await openMenuOnMobile(page, isMobile);
  await page.getByRole("link", { name: "View the site in English" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("shows the build gallery without a pickup locations section", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#builds img")).toHaveCount(5);
  await expect(page.locator("#locations")).toHaveCount(0);
});

test("shows a localized not-found page", async ({ page }) => {
  const response = await page.goto("/fr/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
});

test.describe("mobile menu", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, "the menu replaces the header links on phones");
  });

  const MENUS = {
    en: {
      search: "Search products",
      links: [
        "PC builder",
        "Prebuilt PCs",
        "My account",
        "Cart",
        "Français",
        "Locations",
        "Returns",
        "Warranty",
        "Contact:",
      ],
    },
    fr: {
      search: "Rechercher des produits",
      links: [
        "Configurateur",
        "PC préassemblés",
        "Mon compte",
        "Panier",
        "English",
        "Magasins",
        "Retours",
        "Garantie",
        "Contact :",
      ],
    },
  };

  for (const [locale, { search, links }] of Object.entries(MENUS)) {
    test(`lists the main pages, search, account, cart, language and store links (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      // The open dialog hides the rest of the page from assistive tech.
      const button = page.getByRole("button", { name: "Menu", exact: true, includeHidden: true });
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");

      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu).toBeVisible();
      await expect(menu).toHaveAttribute("id", (await button.getAttribute("aria-controls"))!);
      await expect(menu.getByRole("searchbox", { name: search })).toBeVisible();
      for (const name of links) {
        await expect(menu.getByRole("link", { name })).toBeVisible();
      }
      // Focus moves into the menu and the page behind it doesn't scroll.
      await expect(menu.locator(":focus")).toHaveCount(1);
      await expect(page.locator("body")).toHaveAttribute("data-scroll-locked", /.*/);
    });
  }

  test("following a link closes the menu and marks the current page", async ({ page }) => {
    await page.goto("/en");
    const button = page.getByRole("button", { name: "Menu", exact: true });
    await button.click();
    await page.getByRole("dialog").getByRole("link", { name: "PC builder" }).click();
    await expect(page).toHaveURL(/\/en\/build$/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked", /.*/);

    await button.click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "PC builder" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(menu.getByRole("link", { name: "Prebuilt PCs" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("searches from the menu", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const search = page.getByRole("dialog").getByRole("searchbox", { name: "Search products" });
    await search.fill("ryzen");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=ryzen/);
  });

  test("Escape closes the menu and returns focus to the button", async ({ page }) => {
    await page.goto("/en");
    const button = page.getByRole("button", { name: "Menu", exact: true });
    await button.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("the close button and a tap outside close the menu", async ({ page }) => {
    await page.goto("/fr");
    const button = page.getByRole("button", { name: "Menu", exact: true });
    await button.click();
    await page.getByRole("button", { name: "Fermer le menu" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // The sheet is on the right; the left edge is the backdrop.
    await page.touchscreen.tap(10, 400);
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test("desktop keeps the links in the header, without a menu button", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await page.goto("/en");
  const header = page.getByRole("banner");
  for (const name of ["PC builder", "Prebuilt PCs", "My account", "Cart"]) {
    await expect(header.getByRole("link", { name })).toBeVisible();
  }
  await expect(header.getByRole("searchbox", { name: "Search products" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Menu", exact: true })).toBeHidden();
});
