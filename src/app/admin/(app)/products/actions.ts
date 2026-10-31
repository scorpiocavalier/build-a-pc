"use server";

import { randomUUID } from "node:crypto";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";

import { Prisma } from "@/generated/prisma/client";
import { parseProductInput, type RawProductInput } from "@/lib/catalog/product-input";
import { audit } from "@/server/audit";
import { saveProduct } from "@/server/catalog/save-product";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/require-admin";
import { putObject } from "@/server/storage";

export type ProductFormState = {
  errors?: Record<string, string>;
  // What was submitted, so the form can show it again next to the errors.
  values?: RawProductInput;
};

function formDataToRaw(formData: FormData): RawProductInput {
  const raw: RawProductInput = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React's internal action fields
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    raw[key] = values.length > 1 || key.endsWith("[]") ? values : values[0];
  }
  // Multi-select checkboxes are submitted as "spec.key[]".
  for (const key of Object.keys(raw)) {
    if (key.endsWith("[]")) {
      raw[key.slice(0, -2)] = raw[key];
      delete raw[key];
    }
  }
  return raw;
}

export async function saveProductAction(
  productId: string | null,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireAdmin();
  const raw = formDataToRaw(formData);
  const parsed = parseProductInput(raw);
  if (!parsed.ok) return { errors: parsed.errors, values: raw };

  let id: string;
  try {
    const result = await db.$transaction((tx) =>
      saveProduct(tx, parsed.input, { productId: productId ?? undefined, actorId: user.id }),
    );
    id = result.id;
    await audit({
      actorId: user.id,
      action: productId ? "product.update" : "product.create",
      entity: "product",
      entityId: id,
      summary: `${productId ? "Updated" : "Created"} ${parsed.input.sku} (${parsed.input.status.toLowerCase()})`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { sku: "Another product already uses this SKU" }, values: raw };
    }
    throw error;
  }

  updateTag(CATALOG_TAG);
  redirect(`/admin/products/${id}?saved=1`);
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type ImageUploadState = { error?: string };

export async function uploadProductImage(
  productId: string,
  _prev: ImageUploadState,
  formData: FormData,
): Promise<ImageUploadState> {
  const user = await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That image is larger than 4 MB." };

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { name: true, _count: { select: { images: true } } },
  });
  if (!product) return { error: "Product not found." };

  // Re-encode everything: strips metadata (e.g. GPS), fixes rotation, and
  // rejects files that aren't really images.
  let output;
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return { error: "That file isn't an image we can read (use JPEG, PNG or WebP)." };
  }

  const key = `products/${productId}/${randomUUID()}.webp`;
  await putObject(key, output.data, "image/webp");
  await db.productImage.create({
    data: {
      productId,
      key,
      alt: product.name as Prisma.InputJsonValue,
      width: output.info.width,
      height: output.info.height,
      position: product._count.images,
    },
  });
  await audit({
    actorId: user.id,
    action: "product.image.add",
    entity: "product",
    entityId: productId,
    summary: `Added a photo to ${(product.name as { en: string }).en}`,
  });

  updateTag(CATALOG_TAG);
  return {};
}

export async function deleteProductImage(imageId: string) {
  const user = await requireAdmin();
  // The stored file is left in place; orphaned files can be cleaned up in bulk later.
  const image = await db.productImage.delete({ where: { id: imageId } });
  await audit({
    actorId: user.id,
    action: "product.image.delete",
    entity: "product",
    entityId: image.productId,
    summary: "Removed a product photo",
  });
  updateTag(CATALOG_TAG);
}

export async function makePrimaryImage(imageId: string) {
  await requireAdmin();
  const image = await db.productImage.findUniqueOrThrow({ where: { id: imageId } });
  const images = await db.productImage.findMany({
    where: { productId: image.productId },
    orderBy: { position: "asc" },
  });
  const ordered = [image, ...images.filter((i) => i.id !== image.id)];
  await db.$transaction(
    ordered.map((img, position) =>
      db.productImage.update({ where: { id: img.id }, data: { position } }),
    ),
  );
  updateTag(CATALOG_TAG);
}
