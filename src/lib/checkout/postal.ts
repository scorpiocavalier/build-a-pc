// Canadian postal codes: "A1A 1A1". D, F, I, O, Q and U are never used, and
// W and Z never start a code.
const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPR-TV-Z] ?\d[ABCEGHJ-NPR-TV-Z]\d$/;

export function normalizePostalCode(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!POSTAL.test(s)) return null;
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

// The first location whose delivery prefixes match, e.g. "M" for Toronto or
// "H2" for part of Montreal. Longer prefixes win.
export function matchDeliveryLocation<L extends { deliveryPostalPrefixes: string[] }>(
  postalCode: string,
  locations: L[],
): L | null {
  const compact = postalCode.replace(/\s/g, "").toUpperCase();
  let best: { location: L; length: number } | null = null;
  for (const location of locations) {
    for (const prefix of location.deliveryPostalPrefixes) {
      const p = prefix.replace(/\s/g, "").toUpperCase();
      if (p && compact.startsWith(p) && (!best || p.length > best.length)) {
        best = { location, length: p.length };
      }
    }
  }
  return best?.location ?? null;
}
