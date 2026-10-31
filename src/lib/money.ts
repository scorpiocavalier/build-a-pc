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
