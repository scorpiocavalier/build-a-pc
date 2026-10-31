import type { CategoryDefinition, SpecOption } from "./types";

// Spec definitions for every catalog category. These drive validation, the
// admin product form, CSV import columns and storefront filters.
//
// Values are stored language-neutral (e.g. "AM5", "ATX"); only labels are
// translated. Fields marked required are the ones the PC builder's
// compatibility rules depend on (docs/PLAN.md §7).

const opts = (...values: string[]): SpecOption[] => values.map((value) => ({ value }));

const SOCKETS = opts("AM5", "AM4", "LGA1851", "LGA1700");
const MEMORY_TYPES = opts("DDR5", "DDR4");
const FORM_FACTORS = opts("E-ATX", "ATX", "Micro-ATX", "Mini-ITX");
const PSU_FORM_FACTORS = opts("ATX", "SFX", "SFX-L");
const COLORS: SpecOption[] = [
  { value: "black", label: { en: "Black", fr: "Noir" } },
  { value: "white", label: { en: "White", fr: "Blanc" } },
  { value: "other", label: { en: "Other", fr: "Autre" } },
];

export const CATEGORIES: CategoryDefinition[] = [
  {
    slug: "cpu",
    name: { en: "Processors (CPU)", fr: "Processeurs (CPU)" },
    fields: [
      {
        key: "socket",
        type: "enum",
        options: SOCKETS,
        label: { en: "Socket", fr: "Socle" },
        required: true,
        filter: true,
      },
      {
        key: "cores",
        type: "int",
        min: 1,
        label: { en: "Cores", fr: "Cœurs" },
        required: true,
        filter: true,
      },
      {
        key: "threads",
        type: "int",
        min: 1,
        label: { en: "Threads", fr: "Fils d’exécution" },
        required: true,
      },
      {
        key: "baseClockGhz",
        type: "decimal",
        unit: "GHz",
        min: 0,
        label: { en: "Base clock", fr: "Fréquence de base" },
      },
      {
        key: "boostClockGhz",
        type: "decimal",
        unit: "GHz",
        min: 0,
        label: { en: "Boost clock", fr: "Fréquence maximale" },
      },
      {
        key: "tdpW",
        type: "int",
        unit: "W",
        min: 1,
        label: { en: "TDP", fr: "TDP" },
        required: true,
      },
      {
        key: "integratedGraphics",
        type: "boolean",
        label: { en: "Integrated graphics", fr: "Graphiques intégrés" },
        required: true,
        filter: true,
      },
      {
        key: "memoryTypes",
        type: "multiEnum",
        options: MEMORY_TYPES,
        label: { en: "Memory support", fr: "Mémoire prise en charge" },
        required: true,
      },
      {
        key: "includesCooler",
        type: "boolean",
        label: { en: "Cooler included", fr: "Refroidisseur inclus" },
        required: true,
      },
    ],
  },
  {
    slug: "motherboard",
    name: { en: "Motherboards", fr: "Cartes mères" },
    fields: [
      {
        key: "socket",
        type: "enum",
        options: SOCKETS,
        label: { en: "Socket", fr: "Socle" },
        required: true,
        filter: true,
      },
      {
        key: "chipset",
        type: "text",
        label: { en: "Chipset", fr: "Jeu de puces" },
        required: true,
        filter: true,
      },
      {
        key: "formFactor",
        type: "enum",
        options: FORM_FACTORS,
        label: { en: "Form factor", fr: "Format" },
        required: true,
        filter: true,
      },
      {
        key: "memoryType",
        type: "enum",
        options: MEMORY_TYPES,
        label: { en: "Memory type", fr: "Type de mémoire" },
        required: true,
        filter: true,
      },
      {
        key: "memorySlots",
        type: "int",
        min: 1,
        label: { en: "Memory slots", fr: "Fentes de mémoire" },
        required: true,
      },
      {
        key: "maxMemoryGb",
        type: "int",
        unit: "GB",
        min: 1,
        label: { en: "Max memory", fr: "Mémoire maximale" },
        required: true,
      },
      {
        key: "m2Slots",
        type: "int",
        min: 0,
        label: { en: "M.2 slots", fr: "Fentes M.2" },
        required: true,
      },
      {
        key: "sataPorts",
        type: "int",
        min: 0,
        label: { en: "SATA ports", fr: "Ports SATA" },
        required: true,
      },
      { key: "wifi", type: "boolean", label: { en: "Wi-Fi", fr: "Wi-Fi" }, filter: true },
    ],
  },
  {
    slug: "memory",
    name: { en: "Memory (RAM)", fr: "Mémoire (RAM)" },
    fields: [
      {
        key: "type",
        type: "enum",
        options: MEMORY_TYPES,
        label: { en: "Type", fr: "Type" },
        required: true,
        filter: true,
      },
      {
        key: "modules",
        type: "int",
        min: 1,
        label: { en: "Modules", fr: "Barrettes" },
        required: true,
        filter: true,
      },
      {
        key: "capacityPerModuleGb",
        type: "int",
        unit: "GB",
        min: 1,
        label: { en: "Capacity per module", fr: "Capacité par barrette" },
        required: true,
      },
      {
        key: "speedMts",
        type: "int",
        unit: "MT/s",
        min: 1,
        label: { en: "Speed", fr: "Vitesse" },
        required: true,
      },
      { key: "casLatency", type: "int", min: 1, label: { en: "CAS latency", fr: "Latence CAS" } },
      {
        key: "color",
        type: "enum",
        options: COLORS,
        label: { en: "Colour", fr: "Couleur" },
        filter: true,
      },
      {
        key: "rgb",
        type: "boolean",
        label: { en: "RGB lighting", fr: "Éclairage RGB" },
        filter: true,
      },
    ],
  },
  {
    slug: "storage",
    name: { en: "Storage", fr: "Stockage" },
    fields: [
      {
        key: "type",
        type: "enum",
        options: [
          { value: "nvme", label: { en: "NVMe SSD", fr: "SSD NVMe" } },
          { value: "sata-ssd", label: { en: "SATA SSD", fr: "SSD SATA" } },
          { value: "hdd", label: { en: "Hard drive", fr: "Disque dur" } },
        ],
        label: { en: "Type", fr: "Type" },
        required: true,
        filter: true,
      },
      {
        key: "interface",
        type: "enum",
        options: [
          { value: "m2", label: { en: "M.2", fr: "M.2" } },
          { value: "sata", label: { en: "SATA", fr: "SATA" } },
        ],
        label: { en: "Connection", fr: "Connexion" },
        required: true,
      },
      {
        key: "capacityGb",
        type: "int",
        unit: "GB",
        min: 1,
        label: { en: "Capacity", fr: "Capacité" },
        required: true,
      },
      {
        key: "pcieGen",
        type: "enum",
        options: opts("3", "4", "5"),
        label: { en: "PCIe generation", fr: "Génération PCIe" },
        filter: true,
      },
      {
        key: "readMbps",
        type: "int",
        unit: "MB/s",
        min: 1,
        label: { en: "Read speed", fr: "Vitesse de lecture" },
      },
    ],
  },
  {
    slug: "gpu",
    name: { en: "Graphics cards", fr: "Cartes graphiques" },
    fields: [
      {
        key: "chipset",
        type: "text",
        label: { en: "GPU", fr: "Processeur graphique" },
        required: true,
        filter: true,
      },
      {
        key: "memoryGb",
        type: "int",
        unit: "GB",
        min: 1,
        label: { en: "Video memory", fr: "Mémoire vidéo" },
        required: true,
        filter: true,
      },
      {
        key: "lengthMm",
        type: "int",
        unit: "mm",
        min: 1,
        label: { en: "Length", fr: "Longueur" },
        required: true,
      },
      {
        key: "slotWidth",
        type: "decimal",
        min: 1,
        label: { en: "Slot width", fr: "Largeur (fentes)" },
      },
      {
        key: "boardPowerW",
        type: "int",
        unit: "W",
        min: 1,
        label: { en: "Board power", fr: "Puissance de la carte" },
        required: true,
      },
      {
        key: "powerConnectors",
        type: "multiEnum",
        options: opts("12V-2x6", "8-pin", "6-pin"),
        label: { en: "Power connectors", fr: "Connecteurs d’alimentation" },
        required: true,
      },
      {
        key: "color",
        type: "enum",
        options: COLORS,
        label: { en: "Colour", fr: "Couleur" },
        filter: true,
      },
    ],
  },
  {
    slug: "case",
    name: { en: "Cases", fr: "Boîtiers" },
    fields: [
      {
        key: "motherboardSupport",
        type: "multiEnum",
        options: FORM_FACTORS,
        label: { en: "Motherboard support", fr: "Cartes mères prises en charge" },
        required: true,
        filter: true,
      },
      {
        key: "maxGpuLengthMm",
        type: "int",
        unit: "mm",
        min: 1,
        label: { en: "Max GPU length", fr: "Longueur max. de carte graphique" },
        required: true,
      },
      {
        key: "maxCoolerHeightMm",
        type: "int",
        unit: "mm",
        min: 1,
        label: { en: "Max CPU cooler height", fr: "Hauteur max. du refroidisseur" },
        required: true,
      },
      {
        key: "radiatorSupportMm",
        type: "multiEnum",
        options: opts("120", "140", "240", "280", "360", "420"),
        label: { en: "Radiator support (mm)", fr: "Radiateurs pris en charge (mm)" },
        required: true,
      },
      {
        key: "psuFormFactors",
        type: "multiEnum",
        options: PSU_FORM_FACTORS,
        label: { en: "Power supply support", fr: "Blocs d’alimentation pris en charge" },
        required: true,
      },
      {
        key: "color",
        type: "enum",
        options: COLORS,
        label: { en: "Colour", fr: "Couleur" },
        filter: true,
      },
    ],
  },
  {
    slug: "psu",
    name: { en: "Power supplies", fr: "Blocs d’alimentation" },
    fields: [
      {
        key: "wattage",
        type: "int",
        unit: "W",
        min: 1,
        label: { en: "Wattage", fr: "Puissance" },
        required: true,
        filter: true,
      },
      {
        key: "formFactor",
        type: "enum",
        options: PSU_FORM_FACTORS,
        label: { en: "Form factor", fr: "Format" },
        required: true,
        filter: true,
      },
      {
        key: "efficiency",
        type: "enum",
        options: opts("80+ Bronze", "80+ Gold", "80+ Platinum", "80+ Titanium"),
        label: { en: "Efficiency", fr: "Efficacité" },
        filter: true,
      },
      {
        key: "modular",
        type: "enum",
        options: [
          { value: "full", label: { en: "Fully modular", fr: "Entièrement modulaire" } },
          { value: "semi", label: { en: "Semi-modular", fr: "Semi-modulaire" } },
          { value: "none", label: { en: "Non-modular", fr: "Non modulaire" } },
        ],
        label: { en: "Modular", fr: "Modulaire" },
        filter: true,
      },
      {
        key: "gpuConnectors",
        type: "multiEnum",
        options: opts("12V-2x6", "8-pin", "6-pin"),
        label: { en: "GPU power connectors", fr: "Connecteurs pour carte graphique" },
        required: true,
      },
      {
        key: "color",
        type: "enum",
        options: COLORS,
        label: { en: "Colour", fr: "Couleur" },
        filter: true,
      },
    ],
  },
  {
    slug: "cooler",
    name: { en: "CPU coolers", fr: "Refroidisseurs de processeur" },
    fields: [
      {
        key: "type",
        type: "enum",
        options: [
          { value: "air", label: { en: "Air", fr: "À air" } },
          { value: "aio", label: { en: "Liquid (AIO)", fr: "Liquide (AIO)" } },
        ],
        label: { en: "Type", fr: "Type" },
        required: true,
        filter: true,
      },
      {
        key: "sockets",
        type: "multiEnum",
        options: SOCKETS,
        label: { en: "Socket support", fr: "Socles pris en charge" },
        required: true,
        filter: true,
      },
      {
        key: "heightMm",
        type: "int",
        unit: "mm",
        min: 1,
        label: { en: "Height", fr: "Hauteur" },
        requiredWhen: { key: "type", equals: "air" },
      },
      {
        key: "radiatorMm",
        requiredWhen: { key: "type", equals: "aio" },
        type: "enum",
        options: opts("120", "140", "240", "280", "360", "420"),
        label: { en: "Radiator size (mm)", fr: "Taille du radiateur (mm)" },
        filter: true,
      },
      {
        key: "screen",
        type: "boolean",
        label: { en: "Built-in screen", fr: "Écran intégré" },
        filter: true,
      },
      {
        key: "color",
        type: "enum",
        options: COLORS,
        label: { en: "Colour", fr: "Couleur" },
        filter: true,
      },
    ],
  },
  {
    // Windows licences: sold on their own and included with every assembled build.
    slug: "software",
    name: { en: "Software", fr: "Logiciels" },
    fields: [
      {
        key: "edition",
        type: "enum",
        options: [
          { value: "windows-11-home", label: { en: "Windows 11 Home", fr: "Windows 11 Famille" } },
          {
            value: "windows-11-pro",
            label: { en: "Windows 11 Pro", fr: "Windows 11 Professionnel" },
          },
        ],
        label: { en: "Edition", fr: "Édition" },
        required: true,
        filter: true,
      },
    ],
  },
];

export function getCategoryDefinition(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
