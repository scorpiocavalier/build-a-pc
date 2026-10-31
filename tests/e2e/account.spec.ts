import { expect, test } from "./fixtures";
import {
  addToCart,
  completeOrder,
  createProduct,
  latestEmailTo,
  placePickupOrder,
  uniqueEmail,
} from "./shop-helpers";

test.describe("signing in", () => {
  test("an emailed link signs the customer in and brings in their guest orders", async ({
    page,
    sql,
    isMobile,
  }) => {
    test.skip(isMobile, "places an order; runs once, on desktop");
    const email = uniqueEmail("magic");
    const { order } = await placePickupOrder(page, sql, email);

    await page.goto("/en/account/orders");
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Faccount%2Forders/);
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    const mail = await latestEmailTo(email);
    expect(mail.subject).toContain("Sign in to Astral Tech Gaming");
    const link = mail.text.match(/Sign in: (\S+)/)![1];
    await page.goto(link);

    await expect(page).toHaveURL(/\/en\/account\/orders$/);
    await expect(
      page.getByRole("link", { name: new RegExp(`ATG-${10000 + order.number}`) }),
    ).toBeVisible();

    // A sign-in link works once.
    await page.context().clearCookies();
    await page.goto(link);
    await expect(
      page.getByText("That sign-in link has expired or was already used."),
    ).toBeVisible();
  });

  test("staff can't sign in with an email link", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.ADMIN_EMAILS!.split(",")[0].trim());
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText("Staff accounts sign in with Google")).toBeVisible();
  });

  test("the header links to the account, which asks guests to sign in", async ({ page }) => {
    await page.goto("/fr");
    await page.getByRole("link", { name: "Mon compte" }).click();
    await expect(page).toHaveURL(/\/fr\/sign-in/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });
});

test("the preferred language is saved and used after signing in", async ({ signInAs, sql }) => {
  const email = uniqueEmail("language");
  const page = await signInAs(email);

  await page.goto("/en/account");
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  const { rows } = await sql.query(`SELECT locale FROM "User" WHERE email = $1`, [email]);
  expect(rows[0].locale).toBe("en");

  await page.getByLabel("Preferred language").selectOption("fr");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/fr\/account$/);
  await expect(page.getByRole("heading", { name: "Mon compte" })).toBeVisible();

  // Landing on the account after signing in switches to the saved language.
  await page.goto("/en/account?welcome=1");
  await expect(page).toHaveURL(/\/fr\/account$/);
});

test("saved addresses fill in the delivery form", async ({ signInAs, sql, isMobile }) => {
  test.skip(isMobile, "uses the cart; runs once, on desktop");
  const page = await signInAs(uniqueEmail("address"));
  await page.goto("/en/account/addresses");
  await expect(page.getByText("No saved addresses yet.")).toBeVisible();

  const add = async (fields: Record<string, string>, province: string) => {
    for (const [label, value] of Object.entries(fields)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByLabel("Province").selectOption(province);
  };
  await add(
    {
      "Full name": "Alex Tremblay",
      Phone: "4165550100",
      "Street address": "100 King St W",
      City: "Toronto",
      "Postal code": "m5v3l9",
    },
    "ON",
  );
  await page.getByRole("button", { name: "Add address" }).click();
  await expect(page.getByText("100 King St W, Toronto, ON M5V 3L9")).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();

  await add(
    {
      "Full name": "Alex Tremblay",
      Phone: "bad",
      "Street address": "1 Rue Sainte-Catherine",
      City: "Montréal",
      "Postal code": "H2X 1Y4",
    },
    "QC",
  );
  await page.getByRole("button", { name: "Add address" }).click();
  await expect(page.getByText("Enter a 10-digit phone number")).toBeVisible();
  await page.getByLabel("Phone", { exact: true }).fill("514 555 0199");
  await page.getByLabel("Use as my default address").check();
  await page.getByRole("button", { name: "Add address" }).click();
  await expect(page.getByText("1 Rue Sainte-Catherine, Montréal, QC H2X 1Y4")).toBeVisible();
  // Only one default.
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);

  // Checkout starts from the default address.
  const product = await createProduct(sql);
  await addToCart(page, product.slug);
  await page.goto("/en/checkout");
  await expect(page.getByLabel("Postal code")).toHaveValue("H2X 1Y4");
  await page.getByRole("button", { name: "Check delivery" }).click();
  await expect(page.locator("#line1")).toHaveValue("1 Rue Sainte-Catherine");
  await expect(page.locator("#city")).toHaveValue("Montréal");
  await expect(page.locator("#phone")).toHaveValue("514-555-0199");
});

test("the wishlist keeps products for later", async ({ page, signInAs, sql }) => {
  const product = await createProduct(sql);

  // Guests are asked to sign in first.
  await page.goto(`/en/p/${product.slug}`);
  await page.getByRole("link", { name: "Add to wishlist" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in\?next=/);

  await signInAs(uniqueEmail("wishlist"));
  await page.goto(`/en/p/${product.slug}`);
  await page.getByRole("button", { name: "Add to wishlist" }).click();
  await expect(page.getByRole("button", { name: "In your wishlist" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/en/account/wishlist");
  await expect(page.getByRole("link", { name: new RegExp(product.name) })).toBeVisible();
  await page.getByRole("button", { name: `Remove: ${product.name}` }).click();
  await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
});

test("builds can be saved to the account and reopened", async ({ signInAs, isMobile }) => {
  test.skip(isMobile, "runs once, on desktop");
  const page = await signInAs(uniqueEmail("builds"));

  await page.goto("/en/build/cpu");
  await page.getByRole("button", { name: "Select: Ryzen 5 9600X" }).click();
  await expect(page).toHaveURL(/\/en\/build$/);
  await page.getByLabel("Save this build").fill("Streaming PC");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved to your account")).toBeVisible();

  // "New build" starts over without losing the saved one.
  await page.getByRole("button", { name: "New build" }).click();
  await expect(page.getByRole("link", { name: "Choose: Processor" })).toBeVisible();

  await page.goto("/en/account/builds");
  await expect(page.getByRole("heading", { name: "Streaming PC" })).toBeVisible();
  await page.getByRole("button", { name: "Open in builder: Streaming PC" }).click();
  await expect(page).toHaveURL(/\/en\/build$/);
  await expect(page.getByRole("link", { name: "Change: Processor" })).toBeVisible();

  await page.goto("/en/account/builds");
  await page.getByRole("button", { name: "Delete: Streaming PC" }).click();
  await expect(page.getByText("No saved builds yet.")).toBeVisible();
});

test("customers request returns and staff approve them", async ({
  page,
  sql,
  adminPage,
  isMobile,
}) => {
  test.skip(isMobile, "places an order; runs once, on desktop");
  const email = uniqueEmail("return");
  const { order, product } = await placePickupOrder(page, sql, email);
  const orderPage = `/en/orders/${order.id}?t=${order.accessToken}`;

  // Not before it's been handed over.
  await page.goto(orderPage);
  await expect(page.getByRole("link", { name: "Request a return" })).toHaveCount(0);

  await completeOrder(sql, order.id);
  await page.goto(orderPage);
  await page.getByRole("link", { name: "Request a return" }).click();
  await page.getByLabel(`2 × ${product.name}`).selectOption("1");
  await page.getByLabel("Reason").selectOption("CHANGED_MIND");
  await page.getByLabel("What happened?").fill("Bought one too many fans.");
  await page.getByRole("button", { name: "Send return request" }).click();

  await expect(page.getByText(/Return request RMA-\d+ sent/)).toBeVisible();
  const rma = (await page.getByText(/Return request RMA-\d+ sent/).textContent())!.match(
    /RMA-\d+/,
  )![0];
  await expect(page.getByText("Requested", { exact: true })).toBeVisible();
  // One fan is left to return.
  await expect(page.getByRole("link", { name: "Request a return" })).toBeVisible();
  expect((await latestEmailTo(email)).subject).toBe(`We received your return request ${rma}`);

  await adminPage.goto("/admin/returns");
  const request = adminPage.getByRole("region", { name: rma });
  await expect(request.getByText("Changed mind")).toBeVisible();
  await expect(request.getByText("restocking fee up to $30.00")).toBeVisible();
  await request.getByLabel("Message to the customer").fill("Drop it off at Queen St any day.");
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(request).toHaveCount(0);

  await page.goto(orderPage);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByText("Our message: Drop it off at Queen St any day.")).toBeVisible();
  expect((await latestEmailTo(email)).subject).toBe(`Return ${rma} approved`);

  // After 30 days, returns close.
  await completeOrder(sql, order.id, 31);
  await page.goto(`/en/orders/${order.id}/return?t=${order.accessToken}`);
  await expect(page.getByText("The return period for this order has ended.")).toBeVisible();
});
