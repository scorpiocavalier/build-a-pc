import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Product photos come from R2 in production (R2_PUBLIC_URL).
const imageHost = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null;

// Content Security Policy. Scripts and styles need 'unsafe-inline' because
// Next.js inlines its bootstrap; nonces would make every page dynamic. Card
// details never touch the site (Stripe's hosted Checkout), so no Stripe.js.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${imageHost ? ` ${imageHost.origin}` : ""}`,
  "font-src 'self'",
  "media-src 'self'",
  `connect-src 'self' https://*.sentry.io${process.env.NODE_ENV === "development" ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Browsers only honour this over HTTPS, so it's harmless locally.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: imageHost
      ? [
          {
            protocol: imageHost.protocol.replace(":", "") as "https" | "http",
            hostname: imageHost.hostname,
          },
        ]
      : [],
  },
  partialPrefetching: true,
  experimental: {
    // Product photos are resized in the browser first, so this is plenty and
    // stays under Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Source maps are only uploaded when an auth token is present (CI/Vercel).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: !process.env.CI,
});
