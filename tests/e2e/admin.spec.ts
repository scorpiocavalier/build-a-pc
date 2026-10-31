import { expect, test } from "@playwright/test";

test("sends signed-out visitors from /admin to the admin sign-in page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin sign in");
});

test("does not grant access with a forged session cookie", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "authjs.session-token", value: "forged", url: baseURL! }]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test("keeps the admin out of search engines", async ({ page }) => {
  await page.goto("/admin/sign-in");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});
