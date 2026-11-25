import { describe, expect, it } from "vitest";

import { listedStatuses, removalConfirmation, removalOutcome } from "./product-removal";

const unused = { orders: 0, purchases: 0, featuredBuilds: [], otherBuilds: 0 };
const product = { name: "Test Fan", sku: "FAN-1" };

describe("removalOutcome", () => {
  it("deletes a product that was never sold or bought", () => {
    expect(removalOutcome({ orders: 0, purchases: 0 })).toBe("deleted");
  });

  it("archives a product with orders or purchases", () => {
    expect(removalOutcome({ orders: 1, purchases: 0 })).toBe("archived");
    expect(removalOutcome({ orders: 0, purchases: 2 })).toBe("archived");
  });
});

describe("removalConfirmation", () => {
  it("asks to delete for good", () => {
    const c = removalConfirmation(product, unused);
    expect(c.outcome).toBe("deleted");
    expect(c.title).toBe("Delete Test Fan (FAN-1)?");
    expect(c.body).toEqual(["This can't be undone."]);
    expect(c.confirmLabel).toBe("Delete product");
  });

  it("explains archiving, with counts", () => {
    const c = removalConfirmation(product, { ...unused, orders: 3, purchases: 1 });
    expect(c.outcome).toBe("archived");
    expect(c.title).toBe("Archive Test Fan (FAN-1)?");
    expect(c.confirmLabel).toBe("Archive product");
    expect(c.body).toEqual([
      "This product appears in 3 orders and 1 purchase, so it will be archived instead of deleted. " +
        "It disappears from the store and the builder, and past orders keep it.",
    ]);
  });

  it("leaves out a count of zero", () => {
    expect(removalConfirmation(product, { ...unused, purchases: 2 }).body[0]).toMatch(
      /^This product appears in 2 purchases, so/,
    );
    expect(removalConfirmation(product, { ...unused, orders: 1 }).body[0]).toMatch(
      /^This product appears in 1 order, so/,
    );
  });

  it("lists the prebuilt PCs first, then customer builds", () => {
    const c = removalConfirmation(product, {
      ...unused,
      featuredBuilds: ["Astral White", "Nebula", "Comet"],
      otherBuilds: 2,
    });
    expect(c.body).toEqual([
      "It's part of these prebuilt PCs: “Astral White”, “Nebula” and “Comet”. It will be removed from them, so pick a replacement part.",
      "It will also be removed from 2 customer builds.",
      "This can't be undone.",
    ]);
    expect(
      removalConfirmation(product, { ...unused, orders: 1, featuredBuilds: ["Nebula"] }).body[0],
    ).toBe(
      "It's part of this prebuilt PC: “Nebula”. It will be removed from it, so pick a replacement part.",
    );
  });
});

describe("listedStatuses", () => {
  it("hides archived products by default", () => {
    expect(listedStatuses(undefined)).toEqual(["DRAFT", "ACTIVE"]);
    expect(listedStatuses("")).toEqual(["DRAFT", "ACTIVE"]);
    expect(listedStatuses("nonsense")).toEqual(["DRAFT", "ACTIVE"]);
  });

  it("shows only the chosen status", () => {
    expect(listedStatuses("ARCHIVED")).toEqual(["ARCHIVED"]);
    expect(listedStatuses("ACTIVE")).toEqual(["ACTIVE"]);
  });
});
