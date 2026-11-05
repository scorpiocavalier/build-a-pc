import { describe, expect, it } from "vitest";

import { parseStoreSetting } from "./store-config";

describe("parseStoreSetting", () => {
  it("runs one store when set", () => {
    expect(parseStoreSetting("TOR")).toEqual(["TOR"]);
    expect(parseStoreSetting("MTL")).toEqual(["MTL"]);
  });
  it("runs both stores when unset or unknown", () => {
    expect(parseStoreSetting(undefined)).toEqual(["TOR", "MTL"]);
    expect(parseStoreSetting("OTT")).toEqual(["TOR", "MTL"]);
  });
});
