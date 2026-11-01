import type { MetadataRoute } from "next";

import { siteUrl } from "@/server/seo";

export default function robots(): MetadataRoute.Robots {
  // A Vercel deployment without the real domain configured (a trial or
  // preview with placeholder products) stays out of search engines.
  if (process.env.VERCEL && !process.env.NEXT_PUBLIC_SITE_URL) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
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
