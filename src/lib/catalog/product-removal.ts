import { PRODUCT_STATUSES, type ProductStatus } from "./product-input";

// Removing a product from the admin ("Delete product" on its edit page).
// A product that was never sold or bought is deleted for good. One that
// appears in orders or purchases is archived instead, so past orders,
// refunds, reports and average costs keep working.

export type ProductUsage = {
  // Distinct orders and supplier purchases with a line for the product.
  orders: number;
  purchases: number;
  // Titles of the prebuilt (featured) PCs that contain it.
  featuredBuilds: string[];
  // Other builds (customers' own) that contain it.
  otherBuilds: number;
};

export type RemovalOutcome = "deleted" | "archived";

export function removalOutcome(usage: Pick<ProductUsage, "orders" | "purchases">): RemovalOutcome {
  return usage.orders > 0 || usage.purchases > 0 ? "archived" : "deleted";
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export type RemovalConfirmation = {
  outcome: RemovalOutcome;
  title: string;
  // Paragraphs, in order: the prebuilt PCs it's removed from come first.
  body: string[];
  confirmLabel: string;
};

// The text of the confirmation dialog.
export function removalConfirmation(
  product: { name: string; sku: string },
  usage: ProductUsage,
): RemovalConfirmation {
  const outcome = removalOutcome(usage);
  const label = `${product.name} (${product.sku})`;
  const body: string[] = [];

  if (usage.featuredBuilds.length > 0) {
    body.push(
      `It's part of ${usage.featuredBuilds.length === 1 ? "this prebuilt PC" : "these prebuilt PCs"}: ${joinAnd(
        usage.featuredBuilds.map((t) => `“${t}”`),
      )}. It will be removed from ${usage.featuredBuilds.length === 1 ? "it" : "them"}, so pick a replacement part.`,
    );
  }
  if (usage.otherBuilds > 0) {
    body.push(
      `It will also be removed from ${count(usage.otherBuilds, "customer build", "customer builds")}.`,
    );
  }

  if (outcome === "deleted") {
    body.push("This can't be undone.");
    return { outcome, title: `Delete ${label}?`, body, confirmLabel: "Delete product" };
  }

  const uses = [
    usage.orders > 0 && count(usage.orders, "order", "orders"),
    usage.purchases > 0 && count(usage.purchases, "purchase", "purchases"),
  ].filter((s): s is string => Boolean(s));
  body.push(
    `This product appears in ${joinAnd(uses)}, so it will be archived instead of deleted. ` +
      "It disappears from the store and the builder, and past orders keep it.",
  );
  return { outcome, title: `Archive ${label}?`, body, confirmLabel: "Archive product" };
}

// The statuses the admin products list shows for its Status filter. Archived
// products are hidden unless asked for.
export function listedStatuses(status: string | undefined): ProductStatus[] {
  if (PRODUCT_STATUSES.includes(status as ProductStatus)) return [status as ProductStatus];
  return PRODUCT_STATUSES.filter((s) => s !== "ARCHIVED");
}
