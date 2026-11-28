import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { routing } from "@/i18n/routing";
import { CATALOG_TAG } from "@/server/catalog/queries";
import { db } from "@/server/db";
import { siteUrl } from "@/server/seo";

// Every public page in both languages, with hreflang alternates. Products and
// featured builds come from the database.

const STATIC_PATHS = ["", "/build", "/prebuilt", "/returns", "/warranty", "/privacy", "/terms"];

async function catalogPaths() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
    }),
    db.build.findMany({ where: { featured: true }, select: { shareId: true, updatedAt: true } }),
  ]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, builds] = await catalogPaths();
  const base = siteUrl();
  const entry = (path: string, lastModified?: Date) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [`${l}-CA`, `${base}/${l}${path}`]),
        ),
      },
    }));

  return [
    ...STATIC_PATHS.flatMap((path) => entry(path)),
    ...products.flatMap((p) => entry(`/p/${p.slug}`, p.updatedAt)),
    ...builds.flatMap((b) => entry(`/build/s/${b.shareId}`, b.updatedAt)),
  ];
}
