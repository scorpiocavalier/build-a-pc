// Both stores are in Eastern time (Toronto and Montreal), so staff enter and
// read times in America/Toronto whatever the server's own time zone is.

export const STORE_TIME_ZONE = "America/Toronto";

// Minutes east of UTC in the store time zone at an instant (e.g. -240 in summer).
function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")!.value; // "GMT-04:00"
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

// "2026-11-03" + "14:30" in store time → the instant. Null if malformed.
export function storeTimeToDate(date: string, time: string): Date | null {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.match(/^(\d{2}):(\d{2})$/);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [...d.slice(1), ...t.slice(1)].map(Number);
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const asUtc = Date.UTC(y, mo - 1, da, h, mi);
  // Apply the offset, then re-check it at the result (daylight-saving edges).
  let result = asUtc - offsetMinutes(new Date(asUtc)) * 60_000;
  result = asUtc - offsetMinutes(new Date(result)) * 60_000;
  return new Date(result);
}

// "YYYY-MM-DD" and "HH:MM" of an instant in store time, for form defaults.
export function dateToStoreParts(at: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: STORE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

// Start and end of the store's calendar day containing `at`.
export function storeDayBounds(at: Date): { start: Date; end: Date } {
  const { date } = dateToStoreParts(at);
  const start = storeTimeToDate(date, "00:00")!;
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const end = storeTimeToDate(next.toISOString().slice(0, 10), "00:00")!;
  return { start, end };
}
