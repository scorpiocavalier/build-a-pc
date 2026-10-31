// Where to send a customer after signing in. Only paths on this site are
// allowed, so a crafted sign-in link can't bounce people to another domain.
export function safeNextPath(next: unknown, locale: string): string {
  const fallback = `/${locale}/account?welcome=1`;
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  // "//evil.com" and "/\evil.com" are protocol-relative in browsers.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://site.invalid");
    if (url.origin !== "http://site.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
