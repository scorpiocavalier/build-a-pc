import { describe, expect, it } from "vitest";

import { isAdminEmail, parseAdminEmails } from "./admin-allowlist";

describe("admin allow-list", () => {
  const allowList = parseAdminEmails(" Owner@Example.com, second@example.com ,, ");

  it("parses a comma-separated list, ignoring blanks and case", () => {
    expect([...allowList]).toEqual(["owner@example.com", "second@example.com"]);
  });

  it("matches emails case-insensitively", () => {
    expect(isAdminEmail("OWNER@example.com", allowList)).toBe(true);
  });

  it("rejects emails not on the list, and missing emails", () => {
    expect(isAdminEmail("someone@example.com", allowList)).toBe(false);
    expect(isAdminEmail(null, allowList)).toBe(false);
    expect(isAdminEmail("", allowList)).toBe(false);
  });

  it("allows nobody when the list is empty", () => {
    expect(isAdminEmail("owner@example.com", parseAdminEmails(undefined))).toBe(false);
  });
});
