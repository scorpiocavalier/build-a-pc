// Money is always stored and passed around as integer cents.

export type Currency = "CAD";

export function formatMoney(cents: number, locale: string, currency: Currency = "CAD"): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`Money amounts must be integer cents, got ${cents}`);
  }
  return new Intl.NumberFormat(`${locale}-CA`, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

// Parses an admin-entered dollar amount ("1299.99", "1 299,99 $", "$1,299")
// into cents. Returns null when the input isn't a valid amount.
export function parseDollars(input: string): number | null {
  let s = input.replace(/[\s\u00a0 $]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
