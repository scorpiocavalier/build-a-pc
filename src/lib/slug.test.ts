import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it("makes URL-safe slugs from product names, dropping accents", () => {
    expect(slugify("AMD Ryzen 7 9800X3D")).toBe("amd-ryzen-7-9800x3d");
    expect(slugify("Boîtier « Blanc » 360 mm")).toBe("boitier-blanc-360-mm");
  });
});
