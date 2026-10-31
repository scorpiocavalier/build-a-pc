import Link from "next/link";

import { CategoryIcon } from "@/components/catalog/category-icon";
import { CATEGORIES, getCategoryDefinition } from "@/lib/specs/definitions";
import { listBrandNames } from "@/server/admin/products";

import { ProductForm } from "../product-form";

export const metadata = { title: "New product" };
// Internal pages always wait for fresh data; instant navigation isn't a goal.
export const instant = false;

export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">) {
  const { category } = await searchParams;
  const definition = typeof category === "string" ? getCategoryDefinition(category) : undefined;

  if (!definition) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">New product</h1>
          <p className="text-muted">Choose a category. Its specification fields come next.</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/admin/products/new?category=${c.slug}`}
                className="flex items-center gap-3 rounded-lg border bg-surface p-4 hover:border-accent/60"
              >
                <CategoryIcon slug={c.slug} className="size-5 text-accent" />
                {c.name.en}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/products/new" className="text-sm text-muted hover:text-foreground">
          ← Choose another category
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New product: {definition.name.en}</h1>
      </div>
      <ProductForm
        productId={null}
        definition={definition}
        initial={{ status: "DRAFT", stock_TOR: "0", stock_MTL: "0" }}
        brands={await listBrandNames()}
      />
    </div>
  );
}
