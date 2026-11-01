import type { MetadataRoute } from "next";

import { siteUrl } from "@/server/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or per-visitor pages (they also send noindex).
      disallow: [
        "/admin",
        "/api/",
        "/*/account",
        "/*/cart",
        "/*/checkout",
        "/*/orders/",
        "/*/sign-in",
        "/*/search",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
