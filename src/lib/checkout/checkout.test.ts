import { describe, expect, it } from "vitest";

import { formatOrderNumber, parseOrderNumber } from "./order-number";
import { allowedPaymentMethods, depositFor, paymentStatusFor } from "./payment-rules";
import { matchDeliveryLocation, normalizePostalCode } from "./postal";
import { computeQuote, type TaxRateInput } from "./pricing";
import { availableDates, parseWindow } from "./windows";

const ON: TaxRateInput = { province: "ON", gst: 0, pst: 0, hst: 13000, qst: 0, collect: true };
const QC: TaxRateInput = { province: "QC", gst: 5000, pst: 0, hst: 0, qst: 9975, collect: true };

describe("computeQuote", () => {
  const lines = [
    { unitPriceCents: 64999, quantity: 1 },
    { unitPriceCents: 14999, quantity: 2 },
  ];

  it("charges Ontario HST on goods and delivery", () => {
    expect(computeQuote(lines, 2500, ON)).toEqual({
      subtotalCents: 94997,
      deliveryCents: 2500,
      taxes: [{ name: "HST", rate: 13000, cents: 12675 }], // 974.97 × 13% = 126.7461
      taxCents: 12675,
      totalCents: 110172,
    });
  });

  it("charges Quebec GST and QST separately, each rounded to the cent", () => {
    const quote = computeQuote([{ unitPriceCents: 10000, quantity: 1 }], 0, QC);
    expect(quote.taxes).toEqual([
      { name: "GST", rate: 5000, cents: 500 },
      { name: "QST", rate: 9975, cents: 998 }, // 9.975 rounds up
    ]);
    expect(quote.totalCents).toBe(11498);
  });

  it("charges no tax while collection is switched off", () => {
    const quote = computeQuote(lines, 0, { ...ON, collect: false });
    expect(quote).toMatchObject({ taxes: [], taxCents: 0, totalCents: 94997 });
  });
});

describe("payment rules", () => {
  const settings = { cardEnabled: true, cashMaxCents: 1_000_000, depositPercent: 30 };

  it("offers cash only below the cap", () => {
    expect(allowedPaymentMethods(999_999, settings)).toEqual(["CARD", "ETRANSFER", "CASH"]);
    expect(allowedPaymentMethods(1_000_000, settings)).toEqual(["CARD", "ETRANSFER"]);
  });

  it("hides card payments until Stripe is configured", () => {
    expect(allowedPaymentMethods(5000, { ...settings, cardEnabled: false })).toEqual([
      "ETRANSFER",
      "CASH",
    ]);
  });

  it("requires a deposit only for assembled builds, rounded up", () => {
    expect(depositFor(100_001, false, settings)).toBe(0);
    expect(depositFor(100_001, true, settings)).toBe(30_001);
  });

  it("derives payment status from amounts", () => {
    expect(paymentStatusFor(0, 5000)).toBe("UNPAID");
    expect(paymentStatusFor(1500, 5000)).toBe("PARTIALLY_PAID");
    expect(paymentStatusFor(5000, 5000)).toBe("PAID");
  });
});

describe("postal codes", () => {
  it("normalises valid codes and rejects invalid ones", () => {
    expect(normalizePostalCode(" m5v3l9 ")).toBe("M5V 3L9");
    expect(normalizePostalCode("H2X 1Y4")).toBe("H2X 1Y4");
    expect(normalizePostalCode("12345")).toBeNull();
    expect(normalizePostalCode("D1A 1A1")).toBeNull();
  });

  it("matches the most specific delivery prefix", () => {
    const tor = { code: "TOR", deliveryPostalPrefixes: ["M", "L4"] };
    const mtl = { code: "MTL", deliveryPostalPrefixes: ["H"] };
    const special = { code: "X", deliveryPostalPrefixes: ["M5V"] };
    expect(matchDeliveryLocation("M4C 1A1", [tor, mtl])?.code).toBe("TOR");
    expect(matchDeliveryLocation("M5V 3L9", [tor, special])?.code).toBe("X");
    expect(matchDeliveryLocation("H2X 1Y4", [tor, mtl])?.code).toBe("MTL");
    expect(matchDeliveryLocation("K1A 0B1", [tor, mtl])).toBeNull();
  });
});

describe("pickup and delivery windows", () => {
  // Friday 2026-10-30, 23:30 in Toronto (03:30 UTC Saturday).
  const now = new Date("2026-10-31T03:30:00Z");

  it("starts tomorrow in store time and skips Sundays", () => {
    const dates = availableDates(now);
    expect(dates[0]).toBe("2026-10-31");
    expect(dates).not.toContain("2026-11-01"); // Sunday
    expect(dates).toHaveLength(12);
  });

  it("accepts only offered dates and known slots", () => {
    expect(parseWindow("2026-11-02", "evening", now)).toEqual({
      date: "2026-11-02",
      slot: "evening",
    });
    expect(parseWindow("2026-11-01", "evening", now)).toBeNull();
    expect(parseWindow("2026-11-02", "midnight", now)).toBeNull();
    expect(parseWindow("2026-10-30", "morning", now)).toBeNull();
  });
});

describe("order numbers", () => {
  it("formats and parses", () => {
    expect(formatOrderNumber(42)).toBe("ATG-10042");
    expect(parseOrderNumber("atg-10042")).toBe(42);
    expect(parseOrderNumber("10042")).toBe(42);
    expect(parseOrderNumber("ATG-500")).toBeNull();
  });
});
