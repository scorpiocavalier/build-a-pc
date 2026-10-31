import { describe, expect, it } from "vitest";

import { normalizePhone, parseCheckoutForm } from "./checkout-input";

const now = new Date("2026-10-31T15:00:00Z");
const pickup = {
  fulfilment: "PICKUP",
  location: "MTL",
  date: "2026-11-03",
  slot: "afternoon",
  name: "Alex Tremblay",
  email: " Alex@Example.com ",
  phone: "(514) 555-0199",
  method: "ETRANSFER",
  terms: "on",
};

describe("parseCheckoutForm", () => {
  it("normalises a valid pickup order", () => {
    const result = parseCheckoutForm(pickup, now);
    expect(result).toEqual({
      ok: true,
      input: {
        fulfilment: "PICKUP",
        locationCode: "MTL",
        address: null,
        window: { date: "2026-11-03", slot: "afternoon" },
        name: "Alex Tremblay",
        email: "alex@example.com",
        phone: "514-555-0199",
        method: "ETRANSFER",
        notes: "",
      },
    });
  });

  it("requires an address and a valid postal code for delivery", () => {
    const result = parseCheckoutForm(
      { ...pickup, fulfilment: "DELIVERY", postalCode: "h2x1y4" },
      now,
    );
    expect(result).toEqual({ ok: false, errors: { line1: "required", city: "required" } });

    const ok = parseCheckoutForm(
      {
        ...pickup,
        fulfilment: "DELIVERY",
        postalCode: "h2x1y4",
        line1: "1 Rue Sainte-Catherine",
        city: "Montréal",
      },
      now,
    );
    expect(ok.ok && ok.input.address).toEqual({
      line1: "1 Rue Sainte-Catherine",
      line2: "",
      city: "Montréal",
      postalCode: "H2X 1Y4",
    });
  });

  it("collects every problem at once", () => {
    const result = parseCheckoutForm(
      {
        fulfilment: "PICKUP",
        location: "NYC",
        date: "2026-11-01",
        slot: "noon",
        email: "nope",
        phone: "123",
      },
      now,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        fulfilment: "fulfilment",
        window: "window",
        name: "required",
        email: "email",
        phone: "phone",
        method: "method",
        terms: "terms",
      },
    });
  });
});

describe("normalizePhone", () => {
  it.each([
    ["514 555 0199", "514-555-0199"],
    ["+1 (416) 555-0123", "416-555-0123"],
    ["4165550123", "416-555-0123"],
  ])("accepts %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(["555-0123", "011 44 20 7946 0958", "1 (016) 555-0123"])("rejects %s", (input) =>
    expect(normalizePhone(input)).toBeNull(),
  );
});
