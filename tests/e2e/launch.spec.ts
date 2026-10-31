import { expect, test } from "./fixtures";
import { uniqueEmail } from "./shop-helpers";

test("pages are served with security headers", async ({ request }) => {
  const response = await request.get("/en");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the health check reports the database is up", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("the sitemap lists pages in both languages, and robots points to it", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en/p/amd-ryzen-7-9800x3d</loc>");
  expect(sitemap).toContain(
    'hreflang="fr-CA" href="http://localhost:3000/fr/p/amd-ryzen-7-9800x3d"',
  );
  expect(sitemap).toContain("/fr/returns</loc>");
  expect(sitemap).not.toContain("/admin");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Sitemap: http://localhost:3000/sitemap.xml");
});

test("pages link to their other-language version", async ({ page }) => {
  await page.goto("/fr/shop");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fr\/shop$/);
  await expect(page.locator('link[hreflang="en-CA"]')).toHaveAttribute("href", /\/en\/shop$/);
});

test("the policy pages are linked from the footer, in both languages", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("contentinfo").getByRole("link", { name: "Retours" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Retours et remboursements");
  await expect(page.getByText(/frais de restockage de 30 %/).first()).toBeVisible();

  await page.goto("/en/locations");
  await expect(page.getByRole("heading", { name: /Toronto/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Montreal/ })).toBeVisible();
  const structured = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(structured!)[0]["@type"]).toBe("ComputerStore");
});

test("sign-in links are rate limited per email address", async ({ page }) => {
  const email = uniqueEmail("limit");
  await page.goto("/en/sign-in");
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    await page.reload();
  }
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Too many attempts. Please wait a few minutes")).toBeVisible();
});

test("customers can download their data and delete their account", async ({ signInAs, sql }) => {
  const email = uniqueEmail("delete-me");
  const page = await signInAs(email);
  await page.goto("/en/account");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download my data (JSON)" }).click();
  const file = await download;
  const data = JSON.parse(
    await new Promise<string>((resolve) => {
      let text = "";
      file.createReadStream().then((stream) => {
        stream.on("data", (chunk) => (text += chunk));
        stream.on("end", () => resolve(text));
      });
    }),
  );
  expect(data).toMatchObject({ email, store: "Astral Tech Gaming", orders: [] });

  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Tick the box to confirm.")).toBeVisible();
  await page.getByLabel(/I understand my account/).check();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/en$/);
  const { rowCount } = await sql.query(`SELECT 1 FROM "User" WHERE email = $1`, [email]);
  expect(rowCount).toBe(0);

  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/sign-in/);
});
