// Canadian postal codes: "A1A 1A1". D, F, I, O, Q and U are never used, and
// W and Z never start a code.
const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPR-TV-Z] ?\d[ABCEGHJ-NPR-TV-Z]\d$/;

export function normalizePostalCode(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!POSTAL.test(s)) return null;
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

// Whether the store delivers to a postal code: one of its delivery prefixes,
// like "M" or "L4", starts the code.
export function deliversTo(postalCode: string, prefixes: string[]): boolean {
  const compact = postalCode.replace(/\s/g, "").toUpperCase();
  return prefixes.some((prefix) => {
    const p = prefix.replace(/\s/g, "").toUpperCase();
    return p !== "" && compact.startsWith(p);
  });
}
