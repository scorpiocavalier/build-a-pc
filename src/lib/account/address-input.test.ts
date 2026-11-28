import { describe, expect, it } from "vitest";

import { parseAddressForm } from "./address-input";

describe("parseAddressForm", () => {
  it("normalizes the phone number, postal code and province", () => {
    expect(
      parseAddressForm({
        name: " Alex Tremblay ",
        phone: "(416) 555-0199",
        line1: "100 Queen St W",
        city: "Toronto",
        province: "on",
        postalCode: "m5h2n2",
        isDefault: "on",
      }),
    ).toEqual({
      ok: true,
      input: {
        name: "Alex Tremblay",
        phone: "416-555-0199",
        line1: "100 Queen St W",
        line2: "",
        city: "Toronto",
        province: "ON",
        postalCode: "M5H 2N2",
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
