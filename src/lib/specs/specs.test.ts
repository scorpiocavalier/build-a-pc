import { describe, expect, it } from "vitest";

import { CATEGORIES, getCategoryDefinition } from "./definitions";
import { formatSpecValue } from "./format";
import { parseSpecs } from "./parse";

const cpu = getCategoryDefinition("cpu")!;
const cooler = getCategoryDefinition("cooler")!;

const validCpu = {
  socket: "am5",
  cores: "8",
  threads: "16",
  tdpW: "120",
  integratedGraphics: "yes",
  memoryTypes: "DDR5",
  includesCooler: "non",
  boostClockGhz: "5,2",
};

describe("spec definitions", () => {
  it("covers the eight launch categories with unique slugs", () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual([
      "cpu",
      "motherboard",
      "memory",
      "storage",
      "gpu",
      "case",
      "psu",
      "cooler",
    ]);
  });

  it("has unique field keys and French labels for every field and option", () => {
    for (const category of CATEGORIES) {
      const keys = category.fields.map((f) => f.key);
      expect(new Set(keys).size, category.slug).toBe(keys.length);
      for (const field of category.fields) {
        expect(field.label.fr, `${category.slug}.${field.key}`).not.toBe("");
        if (field.type === "enum" || field.type === "multiEnum") {
          for (const option of field.options) {
            if (option.label) expect(option.label.fr).not.toBe("");
          }
        }
      }
    }
  });

  it("points requiredWhen at real fields and options", () => {
    for (const category of CATEGORIES) {
      for (const field of category.fields) {
        if (!field.requiredWhen) continue;
        const target = category.fields.find((f) => f.key === field.requiredWhen!.key);
        expect(target?.type).toBe("enum");
        if (target?.type === "enum") {
          expect(target.options.map((o) => o.value)).toContain(field.requiredWhen.equals);
        }
      }
    }
  });
});

describe("parseSpecs", () => {
  it("normalises strings from forms and CSV into typed values", () => {
    const result = parseSpecs(cpu, validCpu);
    expect(result).toEqual({
      ok: true,
      values: {
        socket: "AM5",
        cores: 8,
        threads: 16,
        tdpW: 120,
        integratedGraphics: true,
        memoryTypes: ["DDR5"],
        includesCooler: false,
        boostClockGhz: 5.2,
      },
    });
  });

  it("accepts already-typed stored JSON", () => {
    const stored = parseSpecs(cpu, validCpu);
    if (!stored.ok) throw new Error("expected valid");
    expect(parseSpecs(cpu, stored.values)).toEqual(stored);
  });

  it("splits multi-value CSV cells and keeps the definition's order", () => {
    const result = parseSpecs(cpu, { ...validCpu, memoryTypes: "ddr5 | DDR4 | DDR5" });
    expect(result.ok && result.values.memoryTypes).toEqual(["DDR5", "DDR4"]);
  });

  it("reports missing required fields and invalid values", () => {
    const result = parseSpecs(cpu, { ...validCpu, socket: "", cores: "eight", threads: "1.5" });
    expect(result).toEqual({
      ok: false,
      errors: {
        socket: "Socket is required",
        cores: "Cores must be a number",
        threads: "Threads must be a whole number",
      },
    });
  });

  it("enforces fields required only for some variants", () => {
    const base = { type: "air", sockets: "AM5|LGA1851" };
    expect(parseSpecs(cooler, base)).toEqual({
      ok: false,
      errors: { heightMm: "Height is required" },
    });
    expect(parseSpecs(cooler, { ...base, heightMm: "155" }).ok).toBe(true);
    expect(parseSpecs(cooler, { type: "aio", sockets: "AM5" })).toEqual({
      ok: false,
      errors: { radiatorMm: "Radiator size (mm) is required" },
    });
  });

  it("drops keys that aren't in the definition", () => {
    const result = parseSpecs(cpu, { ...validCpu, colour: "red" });
    expect(result.ok && "colour" in result.values).toBe(false);
  });
});

describe("formatSpecValue", () => {
  const field = (key: string) => cpu.fields.find((f) => f.key === key)!;
  const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

  it("formats numbers with units in each language", () => {
    expect(nbsp(formatSpecValue(field("boostClockGhz"), 5.2, "en"))).toBe("5.2 GHz");
    expect(nbsp(formatSpecValue(field("boostClockGhz"), 5.2, "fr"))).toBe("5,2 GHz");
  });

  it("uses French byte units", () => {
    const memory = getCategoryDefinition("gpu")!.fields.find((f) => f.key === "memoryGb")!;
    expect(nbsp(formatSpecValue(memory, 16, "fr"))).toBe("16 Go");
    expect(nbsp(formatSpecValue(memory, 16, "en"))).toBe("16 GB");
  });

  it("translates booleans and option labels", () => {
    expect(formatSpecValue(field("integratedGraphics"), true, "fr")).toBe("Oui");
    const color = getCategoryDefinition("case")!.fields.find((f) => f.key === "color")!;
    expect(formatSpecValue(color, "white", "fr")).toBe("Blanc");
  });
});
