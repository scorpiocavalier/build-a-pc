// Order totals. Everything is integer cents; tax rates are thousandths of a
// percent (13% = 13000, 9.975% = 9975), matching the TaxRate table.

export type TaxRateInput = {
  province: string;
  gst: number;
  pst: number;
  hst: number;
  qst: number;
  collect: boolean;
};

export type TaxLine = { name: "GST" | "PST" | "HST" | "QST"; rate: number; cents: number };

export type Quote = {
  subtotalCents: number;
  deliveryCents: number;
  assemblyCents: number;
  taxes: TaxLine[];
  taxCents: number;
  totalCents: number;
};

export type QuoteLine = { unitPriceCents: number; quantity: number };

// Half-up rounding to the cent, done per tax as on a Canadian receipt.
function taxOn(cents: number, rate: number): number {
  return Math.round((cents * rate) / 100_000);
}

export function computeQuote(
  lines: QuoteLine[],
  deliveryCents: number,
  rate: TaxRateInput | null,
  assemblyCents = 0,
): Quote {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  // Delivery and assembly are taxed like the goods (docs/PLAN.md §6).
  const taxable = subtotalCents + deliveryCents + assemblyCents;
  const taxes: TaxLine[] = [];
  if (rate?.collect) {
    for (const name of ["HST", "GST", "PST", "QST"] as const) {
      const r = rate[name.toLowerCase() as "hst" | "gst" | "pst" | "qst"];
      if (r > 0) taxes.push({ name, rate: r, cents: taxOn(taxable, r) });
    }
  }
  const taxCents = taxes.reduce((sum, t) => sum + t.cents, 0);
  return {
    subtotalCents,
    deliveryCents,
    assemblyCents,
    taxes,
    taxCents,
    totalCents: taxable + taxCents,
  };
}

export function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(`${locale}-CA`, { maximumFractionDigits: 3 }).format(rate / 1000);
}
