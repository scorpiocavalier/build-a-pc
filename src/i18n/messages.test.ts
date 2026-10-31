import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

// Every customer-facing string must exist in both languages (Bill 96).

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe("translation messages", () => {
  const enKeys = flatten(en);
  const frKeys = flatten(fr);

  it("has the same keys in English and French", () => {
    const missingInFr = [...enKeys.keys()].filter((k) => !frKeys.has(k));
    const missingInEn = [...frKeys.keys()].filter((k) => !enKeys.has(k));
    expect({ missingInFr, missingInEn }).toEqual({ missingInFr: [], missingInEn: [] });
  });

  it("has no empty strings", () => {
    const empty = [...enKeys, ...frKeys].filter(([, v]) => v.trim() === "");
    expect(empty).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const mismatched = [...enKeys.keys()]
      .filter((k) => frKeys.has(k))
      .filter((k) => placeholders(enKeys.get(k)!).join() !== placeholders(frKeys.get(k)!).join());
    expect(mismatched).toEqual([]);
  });
});
