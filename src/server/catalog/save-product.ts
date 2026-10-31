import type { MovementReason, Prisma, PrismaClient } from "@/generated/prisma/client";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import type { ProductInput } from "@/lib/catalog/product-input";
import { slugify } from "@/lib/slug";

// Shared by the admin form, CSV import and the seed script, so it takes the
// database client as an argument instead of importing the server-only one.

type Client = PrismaClient | Prisma.TransactionClient;

export type SaveProductOptions = {
  // Update this product instead of matching by SKU (lets admins change a SKU).
  productId?: string;
  actorId?: string | null;
  // Why stock levels changed, for the inventory history.
  stockReason?: MovementReason;
};

export type SaveProductResult = { id: string; slug: string; created: boolean };

async function uniqueSlug(client: Client, base: string, ignoreId?: string) {
  let slug = base;
  for (let n = 2; ; n++) {
    const taken = await client.product.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === ignoreId) return slug;
    slug = `${base}-${n}`;
  }
}

export async function saveProduct(
  client: Client,
  input: ProductInput,
  options: SaveProductOptions = {},
): Promise<SaveProductResult> {
  if (!getCategoryDefinition(input.categorySlug)) {
    throw new Error(`Unknown category ${input.categorySlug}`);
  }
  const category = await client.category.findUniqueOrThrow({
    where: { slug: input.categorySlug },
  });

  const brandSlug = slugify(input.brandName);
  const brand = await client.brand.upsert({
    where: { slug: brandSlug },
    create: { slug: brandSlug, name: input.brandName },
    update: {},
  });

  const existing = options.productId
    ? await client.product.findUniqueOrThrow({ where: { id: options.productId } })
    : await client.product.findUnique({ where: { sku: input.sku } });

  const data = {
    sku: input.sku,
    mpn: input.mpn,
    upc: input.upc,
    name: input.name,
    description: input.description,
    specs: input.specs,
    priceCents: input.priceCents,
    compareAtCents: input.compareAtCents,
    warrantyMonths: input.warrantyMonths,
    status: input.status,
    brandId: brand.id,
    categoryId: category.id,
  };

  const product = existing
    ? await client.product.update({ where: { id: existing.id }, data })
    : await client.product.create({
        data: {
          ...data,
          slug: await uniqueSlug(client, slugify(`${input.brandName} ${input.name.en}`)),
        },
      });

  const reason = options.stockReason ?? (existing ? "ADJUSTMENT" : "INITIAL");
  for (const [code, onHand] of Object.entries(input.stock)) {
    const location = await client.location.findUniqueOrThrow({
      where: { code: code as "TOR" | "MTL" },
    });
    const key = { productId: product.id, locationId: location.id };
    const current = await client.inventory.findUnique({
      where: { productId_locationId: key },
    });
    const delta = onHand - (current?.onHand ?? 0);
    if (current && delta === 0) continue;

    await client.inventory.upsert({
      where: { productId_locationId: key },
      create: { ...key, onHand },
      update: { onHand },
    });
    if (delta !== 0) {
      await client.inventoryMovement.create({
        data: { ...key, delta, reason, actorId: options.actorId ?? null },
      });
    }
  }

  return { id: product.id, slug: product.slug, created: !existing };
}
