import { dateToStoreParts, storeTimeToDate } from "@/lib/store-time";

// Report periods are whole days in store time, "from" and "to" inclusive.

export type ReportRange = { from: string; to: string; start: Date; end: Date };

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function presets(now: Date) {
  const today = dateToStoreParts(now).date;
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  return {
    today: { from: today, to: today },
    month: { from: monthStart, to: today },
    lastMonth: { from: lastMonthStart, to: addDays(monthStart, -1) },
    year: { from: `${y}-01-01`, to: today },
  };
}

export function parseRange(from: unknown, to: unknown, now: Date): ReportRange {
  const fallback = presets(now).month;
  let f = isDay(from) ? from : fallback.from;
  let t = isDay(to) ? to : fallback.to;
  if (f > t) [f, t] = [t, f];
  const start = storeTimeToDate(f, "00:00");
  const end = storeTimeToDate(addDays(t, 1), "00:00");
  if (!start || !end) return parseRange(fallback.from, fallback.to, now);
  return { from: f, to: t, start, end };
}
