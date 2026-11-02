import { describe, expect, it } from "vitest";

import { buildScene, caseSizeFor, type ScenePart } from "./scene";

const part = (scene: ReturnType<typeof buildScene>, slot: ScenePart["slot"]) =>
  scene.parts.find((p) => p.slot === slot)!;

// Every shape of every part stays inside the case.
function insideCase(scene: ReturnType<typeof buildScene>) {
  const [D, H, W] = scene.caseDims;
  for (const p of scene.parts) {
    for (let i = 0; i < 3; i++) {
      const half = [D, H, W][i] / 2;
      expect(p.center[i] - p.size[i] / 2, `${p.slot} axis ${i}`).toBeGreaterThanOrEqual(-half - 1);
      expect(p.center[i] + p.size[i] / 2, `${p.slot} axis ${i}`).toBeLessThanOrEqual(half + 1);
    }
  }
}

describe("buildScene", () => {
  it("shows every slot as a ghost in an empty build", () => {
    const scene = buildScene({});
    expect(scene.hasCase).toBe(false);
    expect(scene.caseSize).toBe("tower");
    // The case is the shell around everything, not one of the parts.
    expect(scene.parts.map((p) => p.slot).sort()).toEqual(
      ["COOLER", "CPU", "GPU", "MEMORY", "MOTHERBOARD", "PSU", "STORAGE", "STORAGE_2"].sort(),
    );
    expect(scene.parts.every((p) => p.ghost)).toBe(true);
    insideCase(scene);
  });

  it("sizes parts from their specs", () => {
    const short = buildScene({ GPU: { specs: { lengthMm: 240, color: "white" }, quantity: 1 } });
    const long = buildScene({ GPU: { specs: { lengthMm: 340 }, quantity: 1 } });
    expect(part(short, "GPU").ghost).toBe(false);
    expect(part(short, "GPU").finish).toBe("white");
    expect(part(long, "GPU").size[0]).toBeGreaterThan(part(short, "GPU").size[0] + 90);
    // Longer cards get a third fan.
    const fans = (s: typeof short) => part(s, "GPU").shapes.filter((x) => x.kind === "fan").length;
    expect([fans(short), fans(long)]).toEqual([2, 3]);
  });

  it("draws memory sticks for each module, up to the board's slots", () => {
    const kit = { specs: { modules: 2, rgb: true }, quantity: 2 };
    const atx = buildScene({
      MEMORY: kit,
      MOTHERBOARD: { specs: { formFactor: "ATX" }, quantity: 1 },
    });
    const itx = buildScene({
      MEMORY: kit,
      MOTHERBOARD: { specs: { formFactor: "Mini-ITX" }, quantity: 1 },
    });
    const sticks = (s: typeof atx) =>
      part(s, "MEMORY").shapes.filter((x) => x.kind === "box" && x.tone === "body").length;
    expect([sticks(atx), sticks(itx)]).toEqual([4, 2]);
    // RGB adds a light strip per stick.
    expect(
      part(atx, "MEMORY").shapes.filter((x) => x.kind === "box" && x.tone === "accent"),
    ).toHaveLength(4);
  });

  it("puts a liquid cooler's radiator under the roof and air coolers on the CPU", () => {
    const aio = buildScene({ COOLER: { specs: { type: "aio", radiatorMm: "360" }, quantity: 1 } });
    const air = buildScene({ COOLER: { specs: { type: "air", heightMm: 150 }, quantity: 1 } });
    const top = aio.caseDims[1] / 2;
    expect(part(aio, "COOLER").center[1] + part(aio, "COOLER").size[1] / 2).toBeGreaterThan(
      top - 60,
    );
    expect(part(aio, "COOLER").shapes.filter((x) => x.kind === "fan")).toHaveLength(3);
    expect(part(air, "COOLER").shapes.filter((x) => x.kind === "fan")).toHaveLength(1);
    insideCase(aio);
    insideCase(air);
  });

  it("picks the case size from the biggest board it takes", () => {
    expect(caseSizeFor({ motherboardSupport: ["ATX", "Micro-ATX"] }, "")).toBe("tower");
    expect(caseSizeFor({ motherboardSupport: ["Mini-ITX"] }, "")).toBe("small");
    expect(caseSizeFor(undefined, "Micro-ATX")).toBe("compact");
    const small = buildScene({
      CASE: { specs: { motherboardSupport: ["Mini-ITX"], color: "white" }, quantity: 1 },
      MOTHERBOARD: { specs: { formFactor: "Mini-ITX" }, quantity: 1 },
      GPU: { specs: { lengthMm: 320 }, quantity: 1 },
      PSU: { specs: { formFactor: "SFX" }, quantity: 1 },
      STORAGE: { specs: { type: "hdd", interface: "sata" }, quantity: 1 },
    });
    expect(small).toMatchObject({ caseSize: "small", hasCase: true, caseFinish: "white" });
    insideCase(small);
  });
});
