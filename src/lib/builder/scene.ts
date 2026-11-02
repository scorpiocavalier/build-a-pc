import type { BuildSlot } from "@/generated/prisma/enums";
import type { SpecValues } from "@/lib/specs/types";

// Lays out a PC build in 3D from the parts' specs: which case and board
// size, and where each part sits. Pure, so it's unit-tested and the viewer
// only draws what this returns.
//
// Units are millimetres. Axes, looking through the case's glass side:
//   x: front of the case (−) to the rear (+)
//   y: bottom (−) to top (+)
//   z: motherboard tray (−) to the glass panel (+)

export type Vec3 = [number, number, number];

export type Finish = "black" | "white" | "other";

export type SceneShape =
  | { kind: "box"; size: Vec3; position: Vec3; tone: Tone }
  | { kind: "fan"; radius: number; position: Vec3; facing: "x" | "y" | "z"; tone: Tone };

// Colour roles the viewer maps to materials.
export type Tone = "body" | "pcb" | "metal" | "dark" | "light" | "accent" | "chip";

export type ScenePart = {
  slot: BuildSlot;
  // Empty slots are drawn as a ghost the customer can click to fill.
  ghost: boolean;
  finish: Finish;
  // Bounding box, used for the hover/selection outline and labels.
  center: Vec3;
  size: Vec3;
  shapes: SceneShape[];
  // Direction and distance the part moves in the exploded view.
  explode: Vec3;
  // Where its "+ Part" label goes when the slot is empty, chosen so labels
  // of neighbouring parts don't overlap.
  label: Vec3;
};

export type CaseSize = "tower" | "compact" | "small";

export type Scene = {
  caseSize: CaseSize;
  caseDims: Vec3; // depth (x), height (y), width (z)
  caseFinish: Finish;
  hasCase: boolean;
  parts: ScenePart[];
};

export type ScenePartInput = { specs: SpecValues; quantity: number };

const CASES: Record<CaseSize, Vec3> = {
  tower: [450, 470, 230],
  compact: [400, 400, 215],
  small: [330, 300, 200],
};

const BOARDS: Record<string, [number, number]> = {
  ATX: [244, 305],
  "Micro-ATX": [244, 244],
  "Mini-ITX": [170, 170],
};

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
const str = (value: unknown) => (typeof value === "string" ? value : "");
const finishOf = (specs: SpecValues | undefined): Finish => {
  const color = str(specs?.color);
  return color === "white" || color === "black" ? color : "other";
};

// The biggest board the case takes decides how big it's drawn.
export function caseSizeFor(caseSpecs: SpecValues | undefined, boardForm: string): CaseSize {
  const support = Array.isArray(caseSpecs?.motherboardSupport)
    ? (caseSpecs.motherboardSupport as string[])
    : [];
  if (support.includes("ATX")) return "tower";
  if (support.includes("Micro-ATX")) return "compact";
  if (support.includes("Mini-ITX")) return "small";
  // No case yet: fit the board.
  return boardForm === "Mini-ITX" ? "small" : boardForm === "Micro-ATX" ? "compact" : "tower";
}

export function buildScene(parts: Partial<Record<BuildSlot, ScenePartInput>>): Scene {
  const board = parts.MOTHERBOARD?.specs;
  const pcCase = parts.CASE?.specs;
  // With no board chosen, show one that fits the case.
  const caseOnly = caseSizeFor(pcCase, "");
  const boardForm =
    str(board?.formFactor) in BOARDS
      ? str(board?.formFactor)
      : caseOnly === "small"
        ? "Mini-ITX"
        : caseOnly === "compact"
          ? "Micro-ATX"
          : "ATX";
  const caseSize = caseSizeFor(pcCase, boardForm);
  const [D, H, W] = CASES[caseSize];

  // Motherboard, against the tray, its I/O edge near the rear.
  const [bw, bh] = BOARDS[boardForm];
  const boardZ = -W / 2 + 22;
  const boardRight = D / 2 - 28;
  const boardTop = H / 2 - 32;
  const boardLeft = boardRight - bw;
  const boardBottom = boardTop - bh;
  const surface = boardZ + 1.5;

  // Landmarks on the board.
  const socket: [number, number] = [boardLeft + bw * 0.58, boardTop - Math.min(85, bh * 0.36)];
  const pcieY = boardForm === "Mini-ITX" ? boardBottom + 34 : socket[1] - 150;
  const m2: [number, number] = [socket[0] - 15, (socket[1] + pcieY) / 2 - 8];

  const out: ScenePart[] = [];
  const add = (
    slot: BuildSlot,
    ghost: boolean,
    finish: Finish,
    shapes: SceneShape[],
    explode: Vec3,
    label?: Vec3,
  ) => {
    const box = bounds(shapes);
    out.push({ slot, ghost, finish, shapes, explode, ...box, label: label ?? box.center });
  };

  // ── Motherboard ──
  add(
    "MOTHERBOARD",
    !board,
    "other",
    [
      {
        kind: "box",
        size: [bw, bh, 3],
        position: [boardLeft + bw / 2, boardBottom + bh / 2, boardZ],
        tone: "pcb",
      },
      // I/O shield block and chipset heatsink, for a bit of detail.
      {
        kind: "box",
        size: [22, Math.min(150, bh * 0.5), 30],
        position: [boardRight - 14, boardTop - Math.min(150, bh * 0.5) / 2 - 8, surface + 15],
        tone: "metal",
      },
      {
        kind: "box",
        size: [40, 40, 8],
        position: [socket[0] + 20, boardBottom + Math.max(30, bh * 0.2), surface + 4],
        tone: "metal",
      },
    ],
    [0, 0, 0],
    [boardLeft + bw * 0.3, boardBottom + 22, surface],
  );

  // ── CPU ──
  add(
    "CPU",
    !parts.CPU,
    "other",
    [
      {
        kind: "box",
        size: [45, 45, 4],
        position: [socket[0], socket[1], surface + 2],
        tone: "chip",
      },
    ],
    [0, 0, 90],
    [socket[0] + 62, socket[1] + 40, surface],
  );

  // ── Cooler ──
  const cooler = parts.COOLER?.specs;
  const coolerShapes: SceneShape[] = [];
  if (!cooler || str(cooler.type) !== "aio") {
    // Air tower: fins plus a fan on its front face.
    const height = Math.min(num(cooler?.heightMm, 155), W - 40);
    coolerShapes.push(
      {
        kind: "box",
        size: [52, 125, height - 6],
        position: [socket[0], socket[1], surface + 6 + (height - 6) / 2],
        tone: "metal",
      },
      {
        kind: "fan",
        radius: 58,
        position: [socket[0] - 40, socket[1], surface + 6 + (height - 6) / 2],
        facing: "x",
        tone: "dark",
      },
    );
  } else {
    // Liquid cooler: pump on the CPU, radiator and fans under the roof.
    const length = num(Number(cooler.radiatorMm), 240) + 35;
    const fans = Math.max(1, Math.round(num(Number(cooler.radiatorMm), 240) / 120));
    const radX = Math.min(D / 2 - 30 - length / 2, boardRight - length / 2);
    const radY = H / 2 - 22;
    coolerShapes.push(
      {
        kind: "box",
        size: [62, 62, 34],
        position: [socket[0], socket[1], surface + 21],
        tone: "dark",
      },
      { kind: "box", size: [length, 27, 122], position: [radX, radY, 0], tone: "dark" },
      ...Array.from({ length: fans }, (_, i): SceneShape => ({
        kind: "fan",
        radius: 57,
        position: [radX - length / 2 + 17 + 60 + i * 120, radY - 27, 0],
        facing: "y",
        tone: "dark",
      })),
    );
  }
  add("COOLER", !parts.COOLER, finishOf(cooler), coolerShapes, [0, 0, 150]);

  // ── Memory ──
  const memory = parts.MEMORY;
  const maxSticks = boardForm === "Mini-ITX" ? 2 : 4;
  const sticks = memory
    ? Math.min(maxSticks, num(memory.specs.modules, 2) * Math.max(1, memory.quantity))
    : 2;
  const memoryShapes: SceneShape[] = [];
  for (let i = 0; i < sticks; i++) {
    const x = socket[0] - 72 - i * 10;
    memoryShapes.push({
      kind: "box",
      size: [7, 133, 34],
      position: [x, socket[1] - 5, surface + 17],
      tone: "body",
    });
    if (memory?.specs.rgb === true) {
      memoryShapes.push({
        kind: "box",
        size: [7.5, 128, 4],
        position: [x, socket[1] - 5, surface + 36],
        tone: "accent",
      });
    }
  }
  add(
    "MEMORY",
    !memory,
    finishOf(memory?.specs),
    memoryShapes,
    [0, 0, 110],
    [socket[0] - 90, socket[1] + 80, surface + 17],
  );

  // ── GPU ──
  const gpu = parts.GPU?.specs;
  const gpuLength = Math.min(num(gpu?.lengthMm, 300), D - 50);
  const gpuThick = Math.min(num(gpu?.slotWidth, 2.5), 4) * 20;
  const gpuX = boardRight + 18 - gpuLength / 2;
  const gpuY = pcieY - gpuThick / 2;
  const gpuZ = surface + 4 + 62;
  const fanCount = gpuLength >= 290 ? 3 : 2;
  const fanR = Math.min(44, gpuLength / (2 * fanCount) - 6);
  add(
    "GPU",
    !gpu,
    finishOf(gpu),
    [
      { kind: "box", size: [gpuLength, gpuThick, 124], position: [gpuX, gpuY, gpuZ], tone: "body" },
      // Light bar on the side facing the glass.
      {
        kind: "box",
        size: [gpuLength * 0.6, 6, 2],
        position: [gpuX, gpuY + gpuThick / 4, gpuZ + 63],
        tone: "accent",
      },
      ...Array.from({ length: fanCount }, (_, i): SceneShape => ({
        kind: "fan",
        radius: fanR,
        position: [
          gpuX - gpuLength / 2 + (gpuLength / fanCount) * (i + 0.5),
          gpuY - gpuThick / 2 - 1,
          gpuZ,
        ],
        facing: "y",
        tone: "dark",
      })),
    ],
    [0, -20, 170],
  );

  // ── Storage ──
  const drive = (slot: "STORAGE" | "STORAGE_2", index: number) => {
    const input = parts[slot];
    const type = str(input?.specs.type);
    const shapes: SceneShape[] = [];
    if (!input || type === "nvme" || str(input.specs.interface) === "m2") {
      const count = input ? Math.min(2, Math.max(1, input.quantity)) : 1;
      for (let i = 0; i < count; i++) {
        shapes.push({
          kind: "box",
          size: [80, 22, 3],
          position: [m2[0], m2[1] - (index + i) * (boardForm === "Mini-ITX" ? 0 : 28), surface + 2],
          tone: "dark",
        });
      }
    } else {
      // 2.5" or 3.5" drive in the bay at the front of the floor.
      const hdd = type === "hdd";
      const size: Vec3 = hdd ? [147, 26, 102] : [100, 7, 70];
      shapes.push({
        kind: "box",
        size,
        position: [-D / 2 + 25 + size[0] / 2, -H / 2 + 12 + size[1] / 2 + index * 32, 0],
        tone: "metal",
      });
    }
    const box = bounds(shapes);
    add(
      slot,
      !input,
      "other",
      shapes,
      [0, 0, 70],
      [box.center[0] - 70, box.center[1], box.center[2]],
    );
  };
  drive("STORAGE", 0);
  drive("STORAGE_2", 1);

  // ── Power supply, bottom rear ──
  const psu = parts.PSU?.specs;
  const psuSize: Vec3 = str(psu?.formFactor) === "SFX" ? [125, 63, 100] : [150, 86, 140];
  add(
    "PSU",
    !psu,
    finishOf(psu),
    [
      {
        kind: "box",
        size: psuSize,
        position: [
          D / 2 - 14 - psuSize[0] / 2,
          -H / 2 + 8 + psuSize[1] / 2,
          -W / 2 + 14 + psuSize[2] / 2,
        ],
        tone: "body",
      },
    ],
    [60, -40, 90],
  );

  return {
    caseSize,
    caseDims: [D, H, W],
    caseFinish: finishOf(pcCase),
    hasCase: !!pcCase,
    parts: out,
  };
}

function bounds(shapes: SceneShape[]): { center: Vec3; size: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const shape of shapes) {
    const half: Vec3 =
      shape.kind === "box"
        ? [shape.size[0] / 2, shape.size[1] / 2, shape.size[2] / 2]
        : shape.facing === "x"
          ? [6, shape.radius, shape.radius]
          : shape.facing === "y"
            ? [shape.radius, 6, shape.radius]
            : [shape.radius, shape.radius, 6];
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], shape.position[i] - half[i]);
      max[i] = Math.max(max[i], shape.position[i] + half[i]);
    }
  }
  return {
    center: [0, 1, 2].map((i) => (min[i] + max[i]) / 2) as Vec3,
    size: [0, 1, 2].map((i) => max[i] - min[i]) as Vec3,
  };
}
