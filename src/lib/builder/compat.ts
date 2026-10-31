import type { BuildSlot } from "@/generated/prisma/enums";
import type { SpecValues } from "@/lib/specs/types";

// PC builder compatibility rules (docs/PLAN.md §7). Pure functions: the
// builder page shows the issues, and the server runs the same checks before
// an assembled build can go in the cart.
//
// Each issue names a message key under "Builder.issues" plus parameters, so
// the page can show it in English or French.

export type Severity = "error" | "warning" | "info";

export type Issue = {
  rule: string;
  severity: Severity;
  slots: BuildSlot[];
  params?: Record<string, string | number>;
};

export type BuildPart = { productId: string; name: string; specs: SpecValues; quantity: number };

export type ResolvedBuild = Partial<Record<BuildSlot, BuildPart>>;

// Specs are validated on save, so these reads only guard against parts whose
// optional fields are blank.
const str = (part: BuildPart | undefined, key: string) =>
  typeof part?.specs[key] === "string" ? (part.specs[key] as string) : undefined;
const num = (part: BuildPart | undefined, key: string) =>
  typeof part?.specs[key] === "number" ? (part.specs[key] as number) : undefined;
const list = (part: BuildPart | undefined, key: string) =>
  Array.isArray(part?.specs[key]) ? (part.specs[key] as string[]) : [];
const bool = (part: BuildPart | undefined, key: string) => part?.specs[key] === true;

const drives = (build: ResolvedBuild) =>
  (["STORAGE", "STORAGE_2"] as const).flatMap((slot) =>
    build[slot] ? [{ slot, part: build[slot]! }] : [],
  );

// Rough peak draw in watts: CPU and GPU ratings plus allowances for the
// board, memory, drives and fans. Deliberately on the high side.
export function estimateWattage(build: ResolvedBuild): number {
  let watts = 0;
  watts += num(build.CPU, "tdpW") ?? 0;
  watts += num(build.GPU, "boardPowerW") ?? 0;
  if (build.MOTHERBOARD) watts += 50;
  if (build.MEMORY) watts += 5 * (num(build.MEMORY, "modules") ?? 2) * build.MEMORY.quantity;
  for (const { part } of drives(build)) watts += 8 * part.quantity;
  if (build.CASE || build.COOLER) watts += 25;
  return watts;
}

// Headroom we recommend over the estimate, as a multiplier.
export const PSU_HEADROOM = 1.3;

type Rule = (build: ResolvedBuild) => Issue[];

// Every issue the rules can raise; each needs a "Builder.issues" message.
export const ISSUE_RULES = [
  "caseBoard",
  "casePsu",
  "coolerHeight",
  "coolerSocket",
  "cpuSocket",
  "gpuConnector",
  "gpuLength",
  "m2Slots",
  "memoryBoard",
  "memoryCapacity",
  "memoryCpu",
  "memorySlots",
  "noCooler",
  "noGraphics",
  "psuHeadroom",
  "psuTooSmall",
  "radiator",
  "sataPorts",
] as const;

const rules: Rule[] = [
  function cpuSocket({ CPU, MOTHERBOARD }) {
    const cpu = str(CPU, "socket");
    const board = str(MOTHERBOARD, "socket");
    return cpu && board && cpu !== board
      ? [
          {
            rule: "cpuSocket",
            severity: "error",
            slots: ["CPU", "MOTHERBOARD"],
            params: { cpu, board },
          },
        ]
      : [];
  },

  function memoryType({ CPU, MOTHERBOARD, MEMORY }) {
    const type = str(MEMORY, "type");
    if (!type) return [];
    const issues: Issue[] = [];
    const board = str(MOTHERBOARD, "memoryType");
    if (board && board !== type) {
      issues.push({
        rule: "memoryBoard",
        severity: "error",
        slots: ["MEMORY", "MOTHERBOARD"],
        params: { type, board },
      });
    }
    const cpuTypes = list(CPU, "memoryTypes");
    if (CPU && cpuTypes.length && !cpuTypes.includes(type)) {
      issues.push({
        rule: "memoryCpu",
        severity: "error",
        slots: ["MEMORY", "CPU"],
        params: { type },
      });
    }
    return issues;
  },

  function memoryFit({ MOTHERBOARD, MEMORY }) {
    if (!MEMORY || !MOTHERBOARD) return [];
    const modules = (num(MEMORY, "modules") ?? 1) * MEMORY.quantity;
    const slots = num(MOTHERBOARD, "memorySlots");
    const capacity = modules * (num(MEMORY, "capacityPerModuleGb") ?? 0);
    const max = num(MOTHERBOARD, "maxMemoryGb");
    const issues: Issue[] = [];
    if (slots !== undefined && modules > slots) {
      issues.push({
        rule: "memorySlots",
        severity: "error",
        slots: ["MEMORY", "MOTHERBOARD"],
        params: { modules, slots },
      });
    }
    if (max !== undefined && capacity > max) {
      issues.push({
        rule: "memoryCapacity",
        severity: "error",
        slots: ["MEMORY", "MOTHERBOARD"],
        params: { capacity, max },
      });
    }
    return issues;
  },

  function boardFitsCase({ MOTHERBOARD, CASE }) {
    const formFactor = str(MOTHERBOARD, "formFactor");
    const supported = list(CASE, "motherboardSupport");
    return formFactor && CASE && !supported.includes(formFactor)
      ? [
          {
            rule: "caseBoard",
            severity: "error",
            slots: ["MOTHERBOARD", "CASE"],
            params: { formFactor },
          },
        ]
      : [];
  },

  function gpuLength({ GPU, CASE }) {
    const length = num(GPU, "lengthMm");
    const max = num(CASE, "maxGpuLengthMm");
    return length !== undefined && max !== undefined && length > max
      ? [{ rule: "gpuLength", severity: "error", slots: ["GPU", "CASE"], params: { length, max } }]
      : [];
  },

  function coolerFit({ CPU, COOLER, CASE }) {
    if (!COOLER) return [];
    const issues: Issue[] = [];
    const socket = str(CPU, "socket");
    if (socket && !list(COOLER, "sockets").includes(socket)) {
      issues.push({
        rule: "coolerSocket",
        severity: "error",
        slots: ["COOLER", "CPU"],
        params: { socket },
      });
    }
    const height = num(COOLER, "heightMm");
    const maxHeight = num(CASE, "maxCoolerHeightMm");
    if (
      str(COOLER, "type") === "air" &&
      height !== undefined &&
      maxHeight !== undefined &&
      height > maxHeight
    ) {
      issues.push({
        rule: "coolerHeight",
        severity: "error",
        slots: ["COOLER", "CASE"],
        params: { height, max: maxHeight },
      });
    }
    const radiator = str(COOLER, "radiatorMm");
    if (
      str(COOLER, "type") === "aio" &&
      radiator &&
      CASE &&
      !list(CASE, "radiatorSupportMm").includes(radiator)
    ) {
      issues.push({
        rule: "radiator",
        severity: "error",
        slots: ["COOLER", "CASE"],
        params: { size: radiator },
      });
    }
    return issues;
  },

  function psuFitsCase({ PSU, CASE }) {
    const formFactor = str(PSU, "formFactor");
    return formFactor && CASE && !list(CASE, "psuFormFactors").includes(formFactor)
      ? [{ rule: "casePsu", severity: "error", slots: ["PSU", "CASE"], params: { formFactor } }]
      : [];
  },

  function driveSlots(build) {
    if (!build.MOTHERBOARD) return [];
    const all = drives(build);
    const count = (iface: string) =>
      all
        .filter(({ part }) => str(part, "interface") === iface)
        .reduce((n, { part }) => n + part.quantity, 0);
    const issues: Issue[] = [];
    const m2 = count("m2");
    const m2Slots = num(build.MOTHERBOARD, "m2Slots") ?? 0;
    const slots = all.map(({ slot }) => slot);
    if (m2 > m2Slots) {
      issues.push({
        rule: "m2Slots",
        severity: "error",
        slots: ["MOTHERBOARD", ...slots],
        params: { drives: m2, slots: m2Slots },
      });
    }
    const sata = count("sata");
    const ports = num(build.MOTHERBOARD, "sataPorts") ?? 0;
    if (sata > ports) {
      issues.push({
        rule: "sataPorts",
        severity: "error",
        slots: ["MOTHERBOARD", ...slots],
        params: { drives: sata, ports },
      });
    }
    return issues;
  },

  function psuWattage(build) {
    const wattage = num(build.PSU, "wattage");
    if (wattage === undefined || (!build.CPU && !build.GPU)) return [];
    const estimate = estimateWattage(build);
    const recommended = Math.ceil((estimate * PSU_HEADROOM) / 50) * 50;
    if (estimate > wattage) {
      return [
        { rule: "psuTooSmall", severity: "error", slots: ["PSU"], params: { estimate, wattage } },
      ];
    }
    if (estimate * PSU_HEADROOM > wattage) {
      return [
        {
          rule: "psuHeadroom",
          severity: "warning",
          slots: ["PSU"],
          params: { estimate, recommended },
        },
      ];
    }
    return [];
  },

  function gpuConnectors({ GPU, PSU }) {
    if (!GPU || !PSU) return [];
    const needs = list(GPU, "powerConnectors");
    const has = list(PSU, "gpuConnectors");
    const missing = needs.filter((c) => !has.includes(c));
    return missing.length
      ? [
          {
            rule: "gpuConnector",
            severity: "warning",
            slots: ["GPU", "PSU"],
            params: { connector: missing.join(", ") },
          },
        ]
      : [];
  },

  function graphicsOutput({ CPU, GPU }) {
    return CPU && !GPU && CPU.specs.integratedGraphics === false
      ? [{ rule: "noGraphics", severity: "error", slots: ["GPU", "CPU"] }]
      : [];
  },

  function cooling({ CPU, COOLER }) {
    return CPU && !COOLER && !bool(CPU, "includesCooler")
      ? [{ rule: "noCooler", severity: "warning", slots: ["COOLER"] }]
      : [];
  },
];

export function checkBuild(build: ResolvedBuild): Issue[] {
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return rules.flatMap((rule) => rule(build)).sort((a, b) => order[a.severity] - order[b.severity]);
}

// Slots we need before we can assemble a working PC. A GPU and cooler are
// only required when the CPU lacks integrated graphics or a bundled cooler.
export function missingForAssembly(build: ResolvedBuild): BuildSlot[] {
  const required: BuildSlot[] = ["CPU", "MOTHERBOARD", "MEMORY", "STORAGE", "CASE", "PSU"];
  if (build.CPU && build.CPU.specs.integratedGraphics === false) required.push("GPU");
  if (build.CPU && !bool(build.CPU, "includesCooler")) required.push("COOLER");
  // Windows goes on a drive, so either storage slot counts.
  return required.filter((slot) =>
    slot === "STORAGE" ? !build.STORAGE && !build.STORAGE_2 : !build[slot],
  );
}

// How a part would fit if placed in a slot: the errors it would cause.
export function candidateErrors(
  build: ResolvedBuild,
  slot: BuildSlot,
  candidate: BuildPart,
): Issue[] {
  return checkBuild({ ...build, [slot]: candidate }).filter(
    (issue) => issue.severity === "error" && issue.slots.includes(slot),
  );
}
