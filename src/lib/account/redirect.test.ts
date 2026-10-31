import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps paths on this site, with their query", () => {
    expect(safeNextPath("/fr/checkout?f=pickup&l=MTL", "fr")).toBe("/fr/checkout?f=pickup&l=MTL");
  });

  it("falls back to the account page for anything else", () => {
    for (const bad of [undefined, "", "account", "https://evil.com", "//evil.com", "/\\evil.com"]) {
      expect(safeNextPath(bad, "en")).toBe("/en/account?welcome=1");
    }
  });
});
