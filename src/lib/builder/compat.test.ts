import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import {
  ISSUE_RULES,
  candidateErrors,
  checkBuild,
  estimateWattage,
  missingForAssembly,
  type BuildPart,
  type ResolvedBuild,
} from "./compat";

const part = (name: string, specs: BuildPart["specs"], quantity = 1): BuildPart => ({
  productId: name,
  name,
  specs,
  quantity,
});

// A complete, compatible white AM5 build based on the seeded catalog.
const cpu = part("Ryzen 5 9600X", {
  socket: "AM5",
  tdpW: 65,
  integratedGraphics: true,
  memoryTypes: ["DDR5"],
  includesCooler: false,
});
const board = part("B850 Aorus Elite", {
  socket: "AM5",
  formFactor: "ATX",
  memoryType: "DDR5",
  memorySlots: 4,
  maxMemoryGb: 256,
  m2Slots: 3,
  sataPorts: 4,
});
const memory = part("T-Force 2×16 GB", { type: "DDR5", modules: 2, capacityPerModuleGb: 16 });
const nvme = part("SN850X", { type: "nvme", interface: "m2" });
const gpu = part("RX 9070 XT", { lengthMm: 320, boardPowerW: 304, powerConnectors: ["8-pin"] });
const pcCase = part("O11 Vision", {
  motherboardSupport: ["ATX", "Micro-ATX", "Mini-ITX"],
  maxGpuLengthMm: 455,
  maxCoolerHeightMm: 167,
  radiatorSupportMm: ["120", "240", "280", "360"],
  psuFormFactors: ["ATX"],
});
const psu = part("1000 W", {
  wattage: 1000,
  formFactor: "ATX",
  gpuConnectors: ["12V-2x6", "8-pin"],
});
const aio = part("MINECUBE 360", { type: "aio", sockets: ["AM5", "AM4"], radiatorMm: "360" });

const complete: ResolvedBuild = {
  CPU: cpu,
  MOTHERBOARD: board,
  MEMORY: memory,
  STORAGE: nvme,
  GPU: gpu,
  CASE: pcCase,
  PSU: psu,
  COOLER: aio,
};

const rules = (build: ResolvedBuild) => checkBuild(build).map((i) => `${i.severity}:${i.rule}`);

describe("checkBuild", () => {
  it("finds nothing wrong with a compatible build", () => {
    expect(checkBuild(complete)).toEqual([]);
    expect(missingForAssembly(complete)).toEqual([]);
  });

  it("flags a CPU and motherboard with different sockets", () => {
    const intelBoard = part("Z890", { ...board.specs, socket: "LGA1851" });
    expect(checkBuild({ CPU: cpu, MOTHERBOARD: intelBoard, COOLER: aio })).toEqual([
      {
        rule: "cpuSocket",
        severity: "error",
        slots: ["CPU", "MOTHERBOARD"],
        params: { cpu: "AM5", board: "LGA1851" },
      },
    ]);
  });

  it("checks memory type against the board and the CPU", () => {
    const ddr4 = part("DDR4 kit", { type: "DDR4", modules: 2, capacityPerModuleGb: 8 });
    expect(rules({ CPU: cpu, MOTHERBOARD: board, MEMORY: ddr4, COOLER: aio })).toEqual([
      "error:memoryBoard",
      "error:memoryCpu",
    ]);
  });

  it("checks memory slots and capacity, counting doubled kits", () => {
    const itx = part("ITX board", { ...board.specs, memorySlots: 2, maxMemoryGb: 48 });
    const twoKits = { ...memory, quantity: 2 };
    expect(
      checkBuild({ MOTHERBOARD: itx, MEMORY: twoKits }).map((i) => [i.rule, i.params]),
    ).toEqual([
      ["memorySlots", { modules: 4, slots: 2 }],
      ["memoryCapacity", { capacity: 64, max: 48 }],
    ]);
  });

  it("checks the case fits the board, GPU, cooler, radiator and power supply", () => {
    const small = part("Small case", {
      motherboardSupport: ["Mini-ITX"],
      maxGpuLengthMm: 300,
      maxCoolerHeightMm: 70,
      radiatorSupportMm: ["240"],
      psuFormFactors: ["SFX"],
    });
    expect(rules({ ...complete, CASE: small })).toEqual([
      "error:caseBoard",
      "error:gpuLength",
      "error:radiator",
      "error:casePsu",
    ]);
    const tallAir = part("Tall air", { type: "air", sockets: ["AM5"], heightMm: 158 });
    expect(rules({ ...complete, CASE: small, COOLER: tallAir })).toContain("error:coolerHeight");
  });

  it("checks the cooler supports the CPU socket", () => {
    const intelOnly = part("Intel cooler", { type: "air", sockets: ["LGA1851"], heightMm: 150 });
    expect(rules({ CPU: cpu, COOLER: intelOnly })).toEqual(["error:coolerSocket"]);
  });

  it("counts M.2 and SATA drives across both storage slots", () => {
    const oneM2 = part("1×M.2 board", { ...board.specs, m2Slots: 1, sataPorts: 0 });
    const hdd = part("HDD", { type: "hdd", interface: "sata" });
    expect(
      checkBuild({ MOTHERBOARD: oneM2, STORAGE: { ...nvme, quantity: 2 }, STORAGE_2: hdd }).map(
        (i) => [i.rule, i.params],
      ),
    ).toEqual([
      ["m2Slots", { drives: 2, slots: 1 }],
      ["sataPorts", { drives: 1, ports: 0 }],
    ]);
  });

  it("estimates power and warns before it errors", () => {
    // 65 CPU + 304 GPU + 50 board + 10 memory + 8 drive + 25 fans
    expect(estimateWattage(complete)).toBe(462);
    const psu550 = part("550 W", { ...psu.specs, wattage: 550 });
    expect(checkBuild({ ...complete, PSU: psu550 })).toEqual([
      {
        rule: "psuHeadroom",
        severity: "warning",
        slots: ["PSU"],
        params: { estimate: 462, recommended: 650 },
      },
    ]);
    const psu450 = part("450 W", { ...psu.specs, wattage: 450 });
    expect(rules({ ...complete, PSU: psu450 })).toEqual(["error:psuTooSmall"]);
  });

  it("warns when the power supply lacks the GPU's connector", () => {
    const nvidia = part("RTX 5080", {
      lengthMm: 340,
      boardPowerW: 360,
      powerConnectors: ["12V-2x6"],
    });
    const oldPsu = part("Old PSU", { wattage: 1000, formFactor: "ATX", gpuConnectors: ["8-pin"] });
    expect(checkBuild({ GPU: nvidia, PSU: oldPsu, CPU: cpu })).toEqual([
      {
        rule: "gpuConnector",
        severity: "warning",
        slots: ["GPU", "PSU"],
        params: { connector: "12V-2x6" },
      },
      { rule: "noCooler", severity: "warning", slots: ["COOLER"] },
    ]);
  });

  it("needs a graphics card when the CPU has no integrated graphics", () => {
    const noIgpu = part("F-series", { ...cpu.specs, integratedGraphics: false });
    expect(rules({ CPU: noIgpu, COOLER: aio })).toEqual(["error:noGraphics"]);
    expect(rules({ CPU: cpu, COOLER: aio })).toEqual([]);
  });
});

describe("missingForAssembly", () => {
  it("lists what's missing, only requiring a GPU and cooler when the CPU needs them", () => {
    expect(missingForAssembly({})).toEqual([
      "CPU",
      "MOTHERBOARD",
      "MEMORY",
      "STORAGE",
      "CASE",
      "PSU",
    ]);
    const boxed = part("Boxed APU", { ...cpu.specs, includesCooler: true });
    const noGpuOrCooler: ResolvedBuild = { ...complete };
    delete noGpuOrCooler.GPU;
    delete noGpuOrCooler.COOLER;
    expect(missingForAssembly({ ...noGpuOrCooler, CPU: boxed })).toEqual([]);
    expect(
      missingForAssembly({
        ...noGpuOrCooler,
        CPU: part("F", { ...cpu.specs, integratedGraphics: false }),
      }),
    ).toEqual(["GPU", "COOLER"]);
  });

  it("accepts a drive in either storage slot", () => {
    const { STORAGE: drive, ...rest } = complete;
    expect(missingForAssembly({ ...rest, STORAGE_2: drive })).toEqual([]);
  });
});

describe("candidateErrors", () => {
  it("reports only errors the candidate itself would cause", () => {
    const intelCpu = part("Core Ultra", { ...cpu.specs, socket: "LGA1851" });
    expect(candidateErrors(complete, "CPU", intelCpu).map((i) => i.rule)).toEqual([
      "cpuSocket",
      "coolerSocket",
    ]);
    // An existing problem elsewhere doesn't count against an unrelated part.
    const small = part("Short case", { ...pcCase.specs, maxGpuLengthMm: 200 });
    expect(candidateErrors({ ...complete, CASE: small }, "MEMORY", memory)).toEqual([]);
  });
});

describe("issue messages", () => {
  it("has an English and French message for every rule", () => {
    for (const rule of ISSUE_RULES) {
      expect(en.Builder.issues, rule).toHaveProperty(rule);
      expect(fr.Builder.issues, rule).toHaveProperty(rule);
    }
  });

  it("only raises rules that are listed", () => {
    const raised = checkBuild({
      CPU: part("x", {
        socket: "AM4",
        integratedGraphics: false,
        memoryTypes: ["DDR4"],
        includesCooler: false,
      }),
      MOTHERBOARD: board,
      MEMORY: memory,
    }).map((i) => i.rule);
    for (const rule of raised) expect(ISSUE_RULES).toContain(rule);
  });
});
