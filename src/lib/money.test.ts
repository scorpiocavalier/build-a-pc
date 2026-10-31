import { describe, expect, it } from "vitest";

import { formatMoney, parseDollars } from "./money";

// Intl uses non-breaking spaces in some locales; normalise for readable asserts.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("formatMoney", () => {
  it("formats CAD for English Canada", () => {
    expect(formatMoney(129999, "en")).toBe("$1,299.99");
  });

  it("formats CAD for French Canada", () => {
    expect(plain(formatMoney(129999, "fr"))).toBe("1 299,99 $");
  });

  it("rejects non-integer cents", () => {
    expect(() => formatMoney(12.5, "en")).toThrow(/integer cents/);
  });
});

describe("parseDollars", () => {
  it.each([
    ["1299.99", 129999],
    ["1,299.99", 129999],
    ["$1,299", 129900],
    ["1 299,99 $", 129999],
    ["49,5", 4950],
    ["0", 0],
  ])("parses %s", (input, cents) => {
    expect(parseDollars(input)).toBe(cents);
  });

  it.each(["", "abc", "12.345", "-5", "1.2.3"])("rejects %s", (input) => {
    expect(parseDollars(input)).toBeNull();
  });
});
