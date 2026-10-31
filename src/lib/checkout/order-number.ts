// Customer-facing order numbers start at ATG-10001 instead of ATG-1.
const OFFSET = 10_000;

export function formatOrderNumber(number: number): string {
  return `ATG-${OFFSET + number}`;
}

export function parseOrderNumber(input: string): number | null {
  const match = /^(?:ATG-?)?(\d+)$/i.exec(input.trim());
  if (!match) return null;
  const n = Number(match[1]) - OFFSET;
  return n > 0 ? n : null;
}
