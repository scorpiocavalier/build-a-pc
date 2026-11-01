import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { addToCart, uniqueEmail } from "./shop-helpers";

// Automated WCAG 2.2 AA checks (axe-core) on the main customer pages, on
// desktop and phone. They don't replace a manual keyboard and screen-reader
// pass, but catch contrast, labels, landmarks and ARIA mistakes.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page, path: string) {
  await page.goto(path);
  // Wait for streamed sections to replace their loading placeholders.
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  expect(summary, `axe violations on ${path}`).toEqual([]);
}

const PUBLIC_PAGES = [
  "/en",
  "/fr",
  "/en/shop",
  "/en/c/cpu",
  "/en/p/amd-ryzen-7-9800x3d",
  "/en/search?q=ryzen",
  "/en/build",
  "/en/build/cpu",
  "/en/prebuilt",
  "/en/build/s/astral-white",
  "/en/sign-in",
  "/en/locations",
  "/fr/returns",
  "/en/privacy",
  "/en/cart",
];

for (const path of PUBLIC_PAGES) {
  test(`no accessibility violations on ${path}`, async ({ page }) => {
    await expectNoViolations(page, path);
  });
}

test("no accessibility violations in the cart and checkout", async ({ page }) => {
  await addToCart(page, "amd-ryzen-5-9600x");
  await expectNoViolations(page, "/en/cart");
  await expectNoViolations(page, "/en/checkout");
  await expectNoViolations(page, "/en/checkout?f=pickup&l=TOR");
});

test("no accessibility violations in the account", async ({ signInAs }) => {
  const page = await signInAs(uniqueEmail("a11y"));
  for (const path of ["/en/account", "/en/account/addresses", "/en/account/builds"]) {
    await expectNoViolations(page, path);
  }
});

test("no accessibility violations in the main admin pages", async ({ adminPage, isMobile }) => {
  test.skip(isMobile, "the admin is used on desktop");
  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/returns?show=all",
    "/admin/inventory",
    "/admin/reports",
    "/admin/settings",
    "/admin/audit",
  ]) {
    await expectNoViolations(adminPage, path);
  }
});
