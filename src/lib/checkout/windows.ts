// Pickup/delivery windows the customer can request. An admin confirms the
// exact time afterwards. Dates are calendar days in Toronto/Montreal time.

export const SLOTS = ["morning", "afternoon", "evening"] as const;
export type Slot = (typeof SLOTS)[number];

export type RequestedWindow = { date: string; slot: Slot };

const TIME_ZONE = "America/Toronto";
const DAYS_AHEAD = 14;

// YYYY-MM-DD for a moment, in the store's time zone.
export function localDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(at);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isSunday(date: string): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

// From tomorrow for two weeks, skipping Sundays.
export function availableDates(now: Date): string[] {
  const today = localDate(now);
  const dates: string[] = [];
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    if (!isSunday(date)) dates.push(date);
  }
  return dates;
}

export function parseWindow(
  date: string | undefined,
  slot: string | undefined,
  now: Date,
): RequestedWindow | null {
  if (!date || !slot) return null;
  if (!(SLOTS as readonly string[]).includes(slot)) return null;
  if (!availableDates(now).includes(date)) return null;
  return { date, slot: slot as Slot };
}

export function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-CA`, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
