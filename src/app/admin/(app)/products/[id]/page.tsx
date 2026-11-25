import { Star, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { productToRaw } from "@/lib/catalog/product-input";
import { removalConfirmation } from "@/lib/catalog/product-removal";
import { getCategoryDefinition } from "@/lib/specs/definitions";
import { getAdminProduct, getProductUsage, listBrandNames } from "@/server/admin/products";

import { deleteProductImage, makePrimaryImage } from "../actions";
import { DeleteProduct } from "../delete-product";
import { ImageUpload } from "../image-upload";
import { ProductForm } from "../product-form";

export const metadata = { title: "Edit product" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]">) {
  const [{ id }, { saved, archived }] = await Promise.all([params, searchParams]);
  const [product, brands, usage] = await Promise.all([
    getAdminProduct(id),
    listBrandNames(),
    getProductUsage(id),
  ]);
  if (!product) notFound();
  const definition = getCategoryDefinition(product.category.slug);
  if (!definition) notFound();

  const initial = productToRaw({
    ...product,
    categorySlug: product.category.slug,
    brandName: product.brand.name,
  });
  const confirmation = removalConfirmation({ name: product.name.en, sku: product.sku }, usage);
  // An archived product that was sold or bought can't go any further.
  const canRemove = !(product.status === "ARCHIVED" && confirmation.outcome === "archived");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {product.brand.name} {product.name.en}
          </h1>
          <p className="text-sm text-muted">
            {definition.name.en}
            {product.status === "ARCHIVED" && (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">Archived</span>
            )}
          </p>
        </div>
        {product.status === "ACTIVE" && (
          <Link
            href={`/en/p/${product.slug}`}
            target="_blank"
            className="text-sm text-accent underline underline-offset-2"
          >
            View on store ↗
          </Link>
        )}
      </div>

      {saved && (
        <p
          role="status"
          className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm"
        >
          Saved.
        </p>
      )}
      {archived && (
        <p
          role="status"
          className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm"
        >
          Archived instead of deleted, because it was sold or purchased before. It no longer shows
          on the store or in the builder.
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-lg border bg-surface/60 p-5">
        <h2 className="font-semibold">Photos</h2>
        {product.images.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {product.images.map((image, i) => (
              <li key={image.id} className="flex flex-col gap-2">
                <div className="relative overflow-hidden rounded-md border">
                  <Image
                    src={image.url}
                    alt={image.alt.en}
                    width={image.width}
                    height={image.height}
                    sizes="160px"
                    className="aspect-square object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-xs">
                      Main
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {i > 0 && (
                    <form action={makePrimaryImage.bind(null, image.id)}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Make main photo"
                        title="Make main photo"
                      >
                        <Star aria-hidden="true" className="size-4" />
                      </Button>
                    </form>
                  )}
                  <form action={deleteProductImage.bind(null, image.id)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete photo"
                      title="Delete photo"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No photos yet. The store shows a placeholder icon.</p>
        )}
        <ImageUpload productId={product.id} />
      </section>

      <ProductForm
        productId={product.id}
        definition={definition}
        initial={initial}
        brands={brands}
      />

      <section
        aria-labelledby="danger-zone"
        className="flex flex-col items-start gap-3 rounded-lg border border-red-400/40 p-5"
      >
        <h2 id="danger-zone" className="font-semibold">
          Danger zone
        </h2>
        {canRemove ? (
          <>
            <p className="text-sm text-muted">
              {confirmation.outcome === "deleted"
                ? "Deletes the product, its photos and its stock records for good."
                : "This product was sold or purchased before, so it will be archived instead of deleted."}
            </p>
            <DeleteProduct productId={product.id} confirmation={confirmation} />
          </>
        ) : (
          <p className="text-sm text-muted">
            This product is archived. It can&apos;t be deleted because past orders or purchases
            include it.
          </p>
        )}
      </section>
    </div>
  );
}
