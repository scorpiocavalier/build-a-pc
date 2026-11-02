import { expect, test } from "./fixtures";

// The 3D builder (preview at /build?view=3d). Parts are inspected and changed
// through the part buttons and the panel below the 3D view, which mirror what
// the canvas shows; the canvas itself needs WebGL, which a test browser may
// not have, so it's checked to render or fall back cleanly.

test("the 3D builder inspects, chooses, swaps and removes parts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/en/build");
  await page.getByRole("link", { name: /^3D/ }).click();
  await expect(page).toHaveURL(/\/en\/build\?view=3d$/);

  const scene = page.getByTestId("scene");
  await expect(
    scene.locator("canvas").or(scene.getByText("Your browser can't show the 3D view.")),
  ).toBeVisible();

  const parts = page.getByRole("navigation", { name: "Parts in your build" });
  await parts.getByRole("button", { name: /^Processor/ }).click();
  await expect(page.getByText("No processor yet.")).toBeVisible();

  await page.getByRole("button", { name: "Choose a processor" }).click();
  await expect(page.getByRole("status").filter({ hasText: /compatible part/ })).toBeVisible();
  await page.getByRole("button", { name: "Select: AMD Ryzen 5 9600X" }).click();
  const inspector = page.getByRole("region", { name: "Processor" });
  await expect(inspector.getByText("AMD Ryzen 5 9600X")).toBeVisible();
  // Key specs, and the list of alternatives closes once one is picked.
  await expect(inspector.getByText(/AM5/).first()).toBeVisible();
  await expect(inspector.getByRole("button", { name: /^Select:/ })).toHaveCount(0);

  // Swapping offers the alternatives and marks the current one.
  await inspector.getByRole("button", { name: "Swap part" }).click();
  await expect(inspector.getByText("In your build")).toBeVisible();
  await inspector.getByRole("button", { name: "Select: AMD Ryzen 7 9800X3D" }).click();
  await expect(inspector.getByText("AMD Ryzen 7 9800X3D")).toBeVisible();

  // The list view shows the same build.
  await page.getByRole("link", { name: "List", exact: true }).click();
  await expect(page.getByRole("link", { name: /Ryzen 7 9800X3D/ })).toBeVisible();

  await page.goto("/en/build?view=3d");
  await parts.getByRole("button", { name: /^Processor/ }).click();
  await inspector.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No processor yet.")).toBeVisible();

  expect(errors).toEqual([]);
});
