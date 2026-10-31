// The admin allow-list lives in the ADMIN_EMAILS env var (comma-separated).
// It is the single source of truth for who can open /admin.

export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(
  email: string | null | undefined,
  allowList = parseAdminEmails(process.env.ADMIN_EMAILS),
): boolean {
  return !!email && allowList.has(email.trim().toLowerCase());
}
