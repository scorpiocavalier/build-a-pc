// Placeholder catalog for development and previews. Real products will come
// from the owner's CSV import. Prices and stock are made up.
//
// Every row goes through the same validation as a CSV import, so the seed
// doubles as a check that the spec definitions accept realistic data.

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { parseProductInput, type RawProductInput } from "../src/lib/catalog/product-input";
import { CATEGORIES } from "../src/lib/specs/definitions";
import { saveProduct } from "../src/server/catalog/save-product";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  }),
});

// Addresses, hours, delivery areas and fees are placeholders; the owner sets
// the real ones in /admin/settings. Seeding never overwrites them.
const LOCATIONS = [
  {
    code: "TOR",
    name: { en: "Toronto", fr: "Toronto" },
    province: "ON",
    address: { en: "Toronto, ON (address to come)", fr: "Toronto (Ontario) (adresse à venir)" },
    hours: { en: "By appointment", fr: "Sur rendez-vous" },
    deliveryPostalPrefixes: ["M"],
    deliveryFeeCents: 2500,
  },
  {
    code: "MTL",
    name: { en: "Montreal", fr: "Montréal" },
    province: "QC",
    address: { en: "Montreal, QC (address to come)", fr: "Montréal (Québec) (adresse à venir)" },
    hours: { en: "By appointment", fr: "Sur rendez-vous" },
    deliveryPostalPrefixes: ["H"],
    deliveryFeeCents: 2500,
  },
] as const;

// Collection starts switched off until the owner confirms registration
// (docs/PLAN.md §6). Rates are thousandths of a percent.
const TAX_RATES = [
  { province: "ON", hst: 13000 },
  { province: "QC", gst: 5000, qst: 9975 },
];

type Row = Omit<RawProductInput, "category" | "status"> & { price: string };

const desc = (en: string, fr: string) => ({ description_en: en, description_fr: fr });

const PRODUCTS: Record<string, Row[]> = {
  software: [
    {
      sku: "WIN11-HOME",
      brand: "Microsoft",
      name_en: "Windows 11 Home (OEM licence)",
      name_fr: "Windows 11 Famille (licence OEM)",
      ...desc("Included with every PC we assemble.", "Inclus avec chaque PC que nous assemblons."),
      price: "159.99",
      stock_TOR: "10",
      stock_MTL: "10",
      "spec.edition": "windows-11-home",
    },
    {
      sku: "WIN11-PRO",
      brand: "Microsoft",
      name_en: "Windows 11 Pro (OEM licence)",
      name_fr: "Windows 11 Professionnel (licence OEM)",
      ...desc(
        "For business features like BitLocker and Remote Desktop.",
        "Pour les fonctions d’entreprise comme BitLocker et le Bureau à distance.",
      ),
      price: "219.99",
      stock_TOR: "5",
      stock_MTL: "5",
      "spec.edition": "windows-11-pro",
    },
  ],
  cpu: [
    {
      sku: "CPU-AMD-9800X3D",
      brand: "AMD",
      name_en: "Ryzen 7 9800X3D",
      name_fr: "Ryzen 7 9800X3D",
      ...desc(
        "8-core gaming processor with 3D V-Cache.",
        "Processeur de jeu à 8 cœurs avec 3D V-Cache.",
      ),
      price: "649.99",
      stock_TOR: "4",
      stock_MTL: "2",
      warranty_months: "36",
      "spec.socket": "AM5",
      "spec.cores": "8",
      "spec.threads": "16",
      "spec.baseClockGhz": "4.7",
      "spec.boostClockGhz": "5.2",
      "spec.tdpW": "120",
      "spec.integratedGraphics": "yes",
      "spec.memoryTypes": "DDR5",
      "spec.includesCooler": "no",
    },
    {
      sku: "CPU-AMD-9600X",
      brand: "AMD",
      name_en: "Ryzen 5 9600X",
      name_fr: "Ryzen 5 9600X",
      ...desc(
        "6-core processor for mid-range gaming builds.",
        "Processeur à 6 cœurs pour les montages de jeu milieu de gamme.",
      ),
      price: "319.99",
      stock_TOR: "6",
      stock_MTL: "5",
      warranty_months: "36",
      "spec.socket": "AM5",
      "spec.cores": "6",
      "spec.threads": "12",
      "spec.baseClockGhz": "3.9",
      "spec.boostClockGhz": "5.4",
      "spec.tdpW": "65",
      "spec.integratedGraphics": "yes",
      "spec.memoryTypes": "DDR5",
      "spec.includesCooler": "no",
    },
    {
      sku: "CPU-INTEL-265K",
      brand: "Intel",
      name_en: "Core Ultra 7 265K",
      name_fr: "Core Ultra 7 265K",
      ...desc(
        "20-core processor for gaming and creative work.",
        "Processeur à 20 cœurs pour le jeu et la création.",
      ),
      price: "459.99",
      stock_TOR: "3",
      stock_MTL: "0",
      warranty_months: "36",
      "spec.socket": "LGA1851",
      "spec.cores": "20",
      "spec.threads": "20",
      "spec.baseClockGhz": "3.9",
      "spec.boostClockGhz": "5.5",
      "spec.tdpW": "125",
      "spec.integratedGraphics": "yes",
      "spec.memoryTypes": "DDR5",
      "spec.includesCooler": "no",
    },
  ],
  motherboard: [
    {
      sku: "MB-GIGA-B850-AE",
      brand: "Gigabyte",
      name_en: "B850 Aorus Elite WiFi7 Ice",
      name_fr: "B850 Aorus Elite WiFi7 Ice",
      ...desc("White ATX board for AM5 with Wi-Fi 7.", "Carte ATX blanche pour AM5 avec Wi-Fi 7."),
      price: "349.99",
      stock_TOR: "3",
      stock_MTL: "2",
      warranty_months: "36",
      "spec.socket": "AM5",
      "spec.chipset": "B850",
      "spec.formFactor": "ATX",
      "spec.memoryType": "DDR5",
      "spec.memorySlots": "4",
      "spec.maxMemoryGb": "256",
      "spec.m2Slots": "3",
      "spec.sataPorts": "4",
      "spec.wifi": "yes",
    },
    {
      sku: "MB-MSI-B650M-A",
      brand: "MSI",
      name_en: "B650M Gaming Plus WiFi",
      name_fr: "B650M Gaming Plus WiFi",
      ...desc(
        "Micro-ATX board for compact AM5 builds.",
        "Carte Micro-ATX pour les montages AM5 compacts.",
      ),
      price: "219.99",
      stock_TOR: "5",
      stock_MTL: "4",
      warranty_months: "36",
      "spec.socket": "AM5",
      "spec.chipset": "B650",
      "spec.formFactor": "Micro-ATX",
      "spec.memoryType": "DDR5",
      "spec.memorySlots": "4",
      "spec.maxMemoryGb": "256",
      "spec.m2Slots": "2",
      "spec.sataPorts": "4",
      "spec.wifi": "yes",
    },
    {
      sku: "MB-ASUS-Z890-I",
      brand: "ASUS",
      name_en: "ROG Strix Z890-I Gaming WiFi",
      name_fr: "ROG Strix Z890-I Gaming WiFi",
      ...desc(
        "Mini-ITX board for small Intel builds.",
        "Carte Mini-ITX pour les petits montages Intel.",
      ),
      price: "529.99",
      stock_TOR: "1",
      stock_MTL: "1",
      warranty_months: "36",
      "spec.socket": "LGA1851",
      "spec.chipset": "Z890",
      "spec.formFactor": "Mini-ITX",
      "spec.memoryType": "DDR5",
      "spec.memorySlots": "2",
      "spec.maxMemoryGb": "128",
      "spec.m2Slots": "2",
      "spec.sataPorts": "2",
      "spec.wifi": "yes",
    },
  ],
  memory: [
    {
      sku: "RAM-TF-D5-32-6000W",
      brand: "TeamGroup",
      name_en: "T-Force Delta RGB 32 GB (2 × 16 GB) DDR5-6000 White",
      name_fr: "T-Force Delta RGB 32 Go (2 × 16 Go) DDR5-6000 blanc",
      ...desc("White RGB DDR5 kit tuned for AM5.", "Ensemble DDR5 RGB blanc optimisé pour AM5."),
      price: "149.99",
      stock_TOR: "8",
      stock_MTL: "6",
      warranty_months: "120",
      "spec.type": "DDR5",
      "spec.modules": "2",
      "spec.capacityPerModuleGb": "16",
      "spec.speedMts": "6000",
      "spec.casLatency": "30",
      "spec.color": "white",
      "spec.rgb": "yes",
    },
    {
      sku: "RAM-CORS-D5-64-6000",
      brand: "Corsair",
      name_en: "Vengeance 64 GB (2 × 32 GB) DDR5-6000",
      name_fr: "Vengeance 64 Go (2 × 32 Go) DDR5-6000",
      ...desc(
        "High-capacity DDR5 kit for gaming and creative work.",
        "Ensemble DDR5 haute capacité pour le jeu et la création.",
      ),
      price: "289.99",
      stock_TOR: "3",
      stock_MTL: "2",
      warranty_months: "120",
      "spec.type": "DDR5",
      "spec.modules": "2",
      "spec.capacityPerModuleGb": "32",
      "spec.speedMts": "6000",
      "spec.casLatency": "30",
      "spec.color": "black",
      "spec.rgb": "no",
    },
    {
      sku: "RAM-KING-D4-16-3200",
      brand: "Kingston",
      name_en: "Fury Beast 16 GB (2 × 8 GB) DDR4-3200",
      name_fr: "Fury Beast 16 Go (2 × 8 Go) DDR4-3200",
      ...desc(
        "Budget DDR4 kit for AM4 and older Intel boards.",
        "Ensemble DDR4 économique pour AM4 et les cartes Intel plus anciennes.",
      ),
      price: "59.99",
      stock_TOR: "5",
      stock_MTL: "0",
      warranty_months: "120",
      "spec.type": "DDR4",
      "spec.modules": "2",
      "spec.capacityPerModuleGb": "8",
      "spec.speedMts": "3200",
      "spec.casLatency": "16",
      "spec.color": "black",
      "spec.rgb": "no",
    },
  ],
  storage: [
    {
      sku: "SSD-SAM-990P-2T",
      brand: "Samsung",
      name_en: "990 Pro 2 TB NVMe SSD",
      name_fr: "SSD NVMe 990 Pro 2 To",
      ...desc(
        "Fast PCIe 4.0 drive for games and Windows.",
        "Disque PCIe 4.0 rapide pour les jeux et Windows.",
      ),
      price: "239.99",
      stock_TOR: "6",
      stock_MTL: "4",
      warranty_months: "60",
      "spec.type": "nvme",
      "spec.interface": "m2",
      "spec.capacityGb": "2000",
      "spec.pcieGen": "4",
      "spec.readMbps": "7450",
    },
    {
      sku: "SSD-WD-SN850X-1T",
      brand: "WD",
      name_en: "WD_Black SN850X 1 TB NVMe SSD",
      name_fr: "SSD NVMe WD_Black SN850X 1 To",
      ...desc(
        "Gaming NVMe drive with a great price per gigabyte.",
        "Disque NVMe de jeu au rapport prix-capacité avantageux.",
      ),
      price: "129.99",
      stock_TOR: "7",
      stock_MTL: "5",
      warranty_months: "60",
      "spec.type": "nvme",
      "spec.interface": "m2",
      "spec.capacityGb": "1000",
      "spec.pcieGen": "4",
      "spec.readMbps": "7300",
    },
    {
      sku: "HDD-SEA-4T",
      brand: "Seagate",
      name_en: "BarraCuda 4 TB Hard Drive",
      name_fr: "Disque dur BarraCuda 4 To",
      ...desc(
        "Bulk storage for media and backups.",
        "Stockage de masse pour les médias et les sauvegardes.",
      ),
      price: "109.99",
      stock_TOR: "2",
      stock_MTL: "2",
      warranty_months: "24",
      "spec.type": "hdd",
      "spec.interface": "sata",
      "spec.capacityGb": "4000",
    },
  ],
  gpu: [
    {
      sku: "GPU-MSI-5070-VENTUS",
      brand: "MSI",
      name_en: "GeForce RTX 5070 Ventus 2X 12G",
      name_fr: "GeForce RTX 5070 Ventus 2X 12G",
      ...desc("Compact RTX 5070 for 1440p gaming.", "RTX 5070 compacte pour le jeu en 1440p."),
      price: "799.99",
      stock_TOR: "3",
      stock_MTL: "2",
      warranty_months: "36",
      "spec.chipset": "GeForce RTX 5070",
      "spec.memoryGb": "12",
      "spec.lengthMm": "242",
      "spec.slotWidth": "2",
      "spec.boardPowerW": "250",
      "spec.powerConnectors": "12V-2x6",
      "spec.color": "black",
    },
    {
      sku: "GPU-GIGA-5080-AERO",
      brand: "Gigabyte",
      name_en: "GeForce RTX 5080 Aero OC 16G",
      name_fr: "GeForce RTX 5080 Aero OC 16G",
      ...desc(
        "White RTX 5080 for 4K gaming in white builds.",
        "RTX 5080 blanche pour le jeu en 4K dans les montages blancs.",
      ),
      price: "1599.99",
      stock_TOR: "1",
      stock_MTL: "1",
      warranty_months: "48",
      "spec.chipset": "GeForce RTX 5080",
      "spec.memoryGb": "16",
      "spec.lengthMm": "340",
      "spec.slotWidth": "3",
      "spec.boardPowerW": "360",
      "spec.powerConnectors": "12V-2x6",
      "spec.color": "white",
    },
    {
      sku: "GPU-SAP-9070XT-PURE",
      brand: "Sapphire",
      name_en: "Pure Radeon RX 9070 XT 16G",
      name_fr: "Pure Radeon RX 9070 XT 16G",
      ...desc(
        "White Radeon card for high-refresh 1440p.",
        "Carte Radeon blanche pour le 1440p à haute fréquence.",
      ),
      price: "959.99",
      stock_TOR: "0",
      stock_MTL: "2",
      warranty_months: "24",
      "spec.chipset": "Radeon RX 9070 XT",
      "spec.memoryGb": "16",
      "spec.lengthMm": "320",
      "spec.slotWidth": "3",
      "spec.boardPowerW": "304",
      "spec.powerConnectors": "8-pin",
      "spec.color": "white",
    },
  ],
  case: [
    {
      sku: "CASE-LL-O11V-W",
      brand: "Lian Li",
      name_en: "O11 Vision White",
      name_fr: "O11 Vision blanc",
      ...desc(
        "Dual-chamber showcase case with glass on three sides.",
        "Boîtier vitrine à double chambre avec verre sur trois côtés.",
      ),
      price: "199.99",
      stock_TOR: "2",
      stock_MTL: "2",
      warranty_months: "12",
      "spec.motherboardSupport": "ATX|Micro-ATX|Mini-ITX",
      "spec.maxGpuLengthMm": "455",
      "spec.maxCoolerHeightMm": "167",
      "spec.radiatorSupportMm": "120|240|280|360",
      "spec.psuFormFactors": "ATX",
      "spec.color": "white",
    },
    {
      sku: "CASE-TT-VIEW270-W",
      brand: "Thermaltake",
      name_en: "View 270 TG ARGB Snow",
      name_fr: "View 270 TG ARGB Snow",
      ...desc(
        "White panoramic mid-tower with ARGB fans.",
        "Moyen boîtier panoramique blanc avec ventilateurs ARGB.",
      ),
      price: "149.99",
      stock_TOR: "3",
      stock_MTL: "1",
      warranty_months: "36",
      "spec.motherboardSupport": "ATX|Micro-ATX|Mini-ITX",
      "spec.maxGpuLengthMm": "400",
      "spec.maxCoolerHeightMm": "175",
      "spec.radiatorSupportMm": "120|140|240|280|360",
      "spec.psuFormFactors": "ATX",
      "spec.color": "white",
    },
    {
      sku: "CASE-FD-NORTH-B",
      brand: "Fractal Design",
      name_en: "North Charcoal Black",
      name_fr: "North noir charbon",
      ...desc("Mid-tower with a walnut front panel.", "Moyen boîtier avec façade en noyer."),
      price: "189.99",
      stock_TOR: "1",
      stock_MTL: "2",
      warranty_months: "24",
      "spec.motherboardSupport": "ATX|Micro-ATX|Mini-ITX",
      "spec.maxGpuLengthMm": "355",
      "spec.maxCoolerHeightMm": "170",
      "spec.radiatorSupportMm": "120|140|240|280|360",
      "spec.psuFormFactors": "ATX",
      "spec.color": "black",
    },
  ],
  psu: [
    {
      sku: "PSU-CORS-RM850X",
      brand: "Corsair",
      name_en: "RM850x 850 W",
      name_fr: "RM850x 850 W",
      ...desc(
        "Quiet, fully modular 80+ Gold power supply.",
        "Bloc d’alimentation silencieux, entièrement modulaire, 80+ Gold.",
      ),
      price: "179.99",
      stock_TOR: "5",
      stock_MTL: "3",
      warranty_months: "120",
      "spec.wattage": "850",
      "spec.formFactor": "ATX",
      "spec.efficiency": "80+ Gold",
      "spec.modular": "full",
      "spec.gpuConnectors": "12V-2x6|8-pin",
      "spec.color": "black",
    },
    {
      sku: "PSU-MSI-A1000G-W",
      brand: "MSI",
      name_en: "MAG A1000GL PCIe 5 White",
      name_fr: "MAG A1000GL PCIe 5 blanc",
      ...desc(
        "1000 W white power supply for high-end GPUs.",
        "Bloc de 1000 W blanc pour les cartes graphiques haut de gamme.",
      ),
      price: "219.99",
      stock_TOR: "2",
      stock_MTL: "2",
      warranty_months: "120",
      "spec.wattage": "1000",
      "spec.formFactor": "ATX",
      "spec.efficiency": "80+ Gold",
      "spec.modular": "full",
      "spec.gpuConnectors": "12V-2x6|8-pin",
      "spec.color": "white",
    },
    {
      sku: "PSU-CM-V750-SFX",
      brand: "Cooler Master",
      name_en: "V750 SFX Gold",
      name_fr: "V750 SFX Gold",
      ...desc(
        "Small form factor power supply for Mini-ITX builds.",
        "Bloc d’alimentation compact pour les montages Mini-ITX.",
      ),
      price: "169.99",
      stock_TOR: "1",
      stock_MTL: "0",
      warranty_months: "120",
      "spec.wattage": "750",
      "spec.formFactor": "SFX",
      "spec.efficiency": "80+ Gold",
      "spec.modular": "full",
      "spec.gpuConnectors": "8-pin",
      "spec.color": "black",
    },
  ],
  cooler: [
    {
      sku: "AIO-TT-MINICUBE-360W",
      brand: "Thermaltake",
      name_en: "MINECUBE 360 Ultra ARGB Snow",
      name_fr: "MINECUBE 360 Ultra ARGB Snow",
      ...desc(
        "White 360 mm liquid cooler with a pump-top screen.",
        "Refroidisseur liquide blanc de 360 mm avec écran sur la pompe.",
      ),
      price: "289.99",
      stock_TOR: "2",
      stock_MTL: "2",
      warranty_months: "60",
      "spec.type": "aio",
      "spec.sockets": "AM5|AM4|LGA1851|LGA1700",
      "spec.radiatorMm": "360",
      "spec.screen": "yes",
      "spec.color": "white",
    },
    {
      sku: "AIO-ARC-LF3-360",
      brand: "Arctic",
      name_en: "Liquid Freezer III Pro 360",
      name_fr: "Liquid Freezer III Pro 360",
      ...desc(
        "Quiet, great-value 360 mm liquid cooler.",
        "Refroidisseur liquide de 360 mm silencieux et abordable.",
      ),
      price: "139.99",
      stock_TOR: "4",
      stock_MTL: "3",
      warranty_months: "72",
      "spec.type": "aio",
      "spec.sockets": "AM5|AM4|LGA1851|LGA1700",
      "spec.radiatorMm": "360",
      "spec.screen": "no",
      "spec.color": "black",
    },
    {
      sku: "AIR-TR-PA120SE",
      brand: "Thermalright",
      name_en: "Peerless Assassin 120 SE",
      name_fr: "Peerless Assassin 120 SE",
      ...desc(
        "Dual-tower air cooler with excellent value.",
        "Refroidisseur à air à double tour, excellent rapport qualité-prix.",
      ),
      price: "49.99",
      stock_TOR: "6",
      stock_MTL: "6",
      warranty_months: "36",
      "spec.type": "air",
      "spec.sockets": "AM5|AM4|LGA1851|LGA1700",
      "spec.heightMm": "155",
      "spec.screen": "no",
      "spec.color": "black",
    },
  ],
};

// Example prebuilt PCs for /prebuilt, made from the placeholder parts above.
const FEATURED_BUILDS = [
  {
    shareId: "astral-white",
    title: { en: "Astral White", fr: "Astral Blanc" },
    description: {
      en: "An all-white 1440p build with a Radeon RX 9070 XT and a 360 mm liquid cooler with a screen.",
      fr: "Un montage tout blanc pour le 1440p avec une Radeon RX 9070 XT et un refroidisseur liquide de 360 mm à écran.",
    },
    location: "MTL" as const,
    parts: {
      CPU: "CPU-AMD-9600X",
      MOTHERBOARD: "MB-GIGA-B850-AE",
      MEMORY: "RAM-TF-D5-32-6000W",
      STORAGE: "SSD-WD-SN850X-1T",
      GPU: "GPU-SAP-9070XT-PURE",
      CASE: "CASE-LL-O11V-W",
      PSU: "PSU-MSI-A1000G-W",
      COOLER: "AIO-TT-MINICUBE-360W",
    },
  },
  {
    shareId: "astral-midnight",
    title: { en: "Astral Midnight", fr: "Astral Minuit" },
    description: {
      en: "A quiet black-and-walnut gaming PC with the Ryzen 7 9800X3D and an RTX 5070.",
      fr: "Un PC de jeu silencieux noir et noyer avec le Ryzen 7 9800X3D et une RTX 5070.",
    },
    location: "TOR" as const,
    parts: {
      CPU: "CPU-AMD-9800X3D",
      MOTHERBOARD: "MB-MSI-B650M-A",
      MEMORY: "RAM-CORS-D5-64-6000",
      STORAGE: "SSD-SAM-990P-2T",
      GPU: "GPU-MSI-5070-VENTUS",
      CASE: "CASE-FD-NORTH-B",
      PSU: "PSU-CORS-RM850X",
      COOLER: "AIO-ARC-LF3-360",
    },
  },
];

async function main() {
  for (const location of LOCATIONS) {
    const data = { ...location, deliveryPostalPrefixes: [...location.deliveryPostalPrefixes] };
    const existing = await db.location.findUnique({ where: { code: location.code } });
    if (!existing) await db.location.create({ data });
    // Fill in placeholders only where the owner hasn't set anything yet.
    else if (existing.deliveryPostalPrefixes.length === 0) {
      await db.location.update({ where: { code: location.code }, data });
    }
  }

  for (const rate of TAX_RATES) {
    await db.taxRate.upsert({ where: { province: rate.province }, create: rate, update: {} });
  }

  for (const [position, category] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, name: category.name, position },
      update: { name: category.name, position },
    });
  }

  let created = 0;
  for (const [category, rows] of Object.entries(PRODUCTS)) {
    for (const row of rows) {
      const parsed = parseProductInput({ ...row, category, status: "ACTIVE" });
      if (!parsed.ok) {
        throw new Error(`Seed row ${row.sku} is invalid: ${JSON.stringify(parsed.errors)}`);
      }
      const result = await saveProduct(db, parsed.input);
      if (result.created) created++;
    }
  }

  for (const [position, featured] of FEATURED_BUILDS.entries()) {
    const products = await db.product.findMany({
      where: { sku: { in: Object.values(featured.parts) } },
    });
    const bySku = new Map(products.map((p) => [p.sku, p.id]));
    const data = {
      featured: true,
      title: featured.title,
      description: featured.description,
      location: featured.location,
      position,
    };
    const build = await db.build.upsert({
      where: { shareId: featured.shareId },
      create: {
        ...data,
        shareId: featured.shareId,
        editToken: randomBytes(24).toString("base64url"),
      },
      update: data,
    });
    await db.buildItem.deleteMany({ where: { buildId: build.id } });
    await db.buildItem.createMany({
      data: Object.entries(featured.parts).map(([slot, sku]) => ({
        buildId: build.id,
        slot: slot as keyof typeof featured.parts,
        productId: bySku.get(sku)!,
      })),
    });
  }

  console.log(
    `Seeded ${LOCATIONS.length} locations, ${CATEGORIES.length} categories, ${created} new products, ${FEATURED_BUILDS.length} featured builds.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
