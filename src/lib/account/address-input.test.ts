import { describe, expect, it } from "vitest";

import { parseAddressForm } from "./address-input";

describe("parseAddressForm", () => {
  it("normalizes the phone number, postal code and province", () => {
    expect(
      parseAddressForm({
        name: " Alex Tremblay ",
        phone: "(514) 555-0199",
        line1: "1 Rue Sainte-Catherine",
        city: "Montréal",
        province: "qc",
        postalCode: "h2x1y4",
        isDefault: "on",
      }),
    ).toEqual({
      ok: true,
      input: {
        name: "Alex Tremblay",
        phone: "514-555-0199",
        line1: "1 Rue Sainte-Catherine",
        line2: "",
        city: "Montréal",
        province: "QC",
        postalCode: "H2X 1Y4",
        isDefault: true,
      },
    });
  });

  it("reports each problem by field", () => {
    expect(parseAddressForm({ phone: "123", postalCode: "12345", province: "XX" })).toEqual({
      ok: false,
      errors: {
        name: "required",
        line1: "required",
        city: "required",
        phone: "phone",
        postalCode: "postalCode",
        province: "province",
      },
    });
  });
});
