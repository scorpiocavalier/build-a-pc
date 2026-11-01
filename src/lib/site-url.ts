// The site's public address, without a trailing slash. NEXT_PUBLIC_SITE_URL
// wins (set it to https://astralgaming.ca at launch); on Vercel without it,
// the project's production domain is used, so a first deploy works as is.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
