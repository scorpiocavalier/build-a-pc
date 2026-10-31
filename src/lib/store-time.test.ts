import { describe, expect, it } from "vitest";

import { dateToStoreParts, storeDayBounds, storeTimeToDate } from "./store-time";

describe("store time (America/Toronto)", () => {
  it("converts local times to instants across daylight saving", () => {
    expect(storeTimeToDate("2026-07-15", "14:30")?.toISOString()).toBe("2026-07-15T18:30:00.000Z");
    expect(storeTimeToDate("2026-12-15", "14:30")?.toISOString()).toBe("2026-12-15T19:30:00.000Z");
    // The day the clocks go back (Nov 1, 2026).
    expect(storeTimeToDate("2026-11-01", "12:00")?.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(storeTimeToDate("2026-13-01", "10:00")).toBeNull();
    expect(storeTimeToDate("2026-11-01", "25:00")).toBeNull();
    expect(storeTimeToDate("tomorrow", "10:00")).toBeNull();
  });

  it("round-trips and finds the store's day", () => {
    const at = new Date("2026-11-03T03:30:00Z"); // 10:30 p.m. on Nov 2 in Toronto
    expect(dateToStoreParts(at)).toEqual({ date: "2026-11-02", time: "22:30" });
    const { start, end } = storeDayBounds(at);
    expect(start.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-03T05:00:00.000Z");
  });
});
