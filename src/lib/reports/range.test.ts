import { describe, expect, it } from "vitest";

import { parseRange, presets } from "./range";

const now = new Date("2026-11-15T17:00:00Z");

describe("report ranges", () => {
  it("defaults to this month so far, in store time", () => {
    const range = parseRange(undefined, undefined, now);
    expect(range.from).toBe("2026-11-01");
    expect(range.to).toBe("2026-11-15");
    expect(range.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-16T05:00:00.000Z");
  });

  it("swaps reversed dates and ignores junk", () => {
    expect(parseRange("2026-10-31", "2026-10-01", now)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(parseRange("yesterday", "2026-02-30x", now).from).toBe("2026-11-01");
  });

  it("offers last month across a year boundary", () => {
    expect(presets(new Date("2026-01-10T17:00:00Z")).lastMonth).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
