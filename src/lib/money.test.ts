import { describe, expect, it } from "vitest";

import { formatMoney } from "./money";

// Intl uses non-breaking spaces in some locales; normalise for readable asserts.
const plain = (s: string) => s.replace(/[  ]/g, " ");

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
