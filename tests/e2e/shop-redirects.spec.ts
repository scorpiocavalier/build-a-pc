import { expect, test } from "@playwright/test";

// The parts shop (/shop and /c/<category>) was removed (#34). Old links and
// search results land on the prebuilt PCs in the same language.

const PREFIXED = [
  ["/en/shop", "/en/prebuilt"],
  ["/fr/shop", "/fr/prebuilt"],
  ["/en/c/cpu", "/en/prebuilt"],
  ["/fr/c/gpu", "/fr/prebuilt"],
  ["/en/c/not-a-category", "/en/prebuilt"],
];

for (const [from, to] of PREFIXED) {
  test(`${from} redirects permanently to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(to);
  });
}

test("unprefixed shop and category links redirect permanently to /prebuilt", async ({
  request,
}) => {
  for (const from of ["/shop", "/c/memory"]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/prebuilt");
  }
});

test("old shop links open the prebuilt PCs page in English", async ({ page }) => {
  for (const from of ["/shop", "/c/cpu", "/en/c/gpu?socket=AM5"]) {
    await page.goto(from);
    await expect(page).toHaveURL(/\/en\/prebuilt(\?.*)?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
  }
});

test("old shop links open the prebuilt PCs page in French", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-CA" });
  const page = await context.newPage();
  for (const from of ["/shop", "/c/gpu", "/fr/shop", "/fr/c/cpu"]) {
    await page.goto(from);
    await expect(page).toHaveURL(/\/fr\/prebuilt$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  }
  await context.close();
});
