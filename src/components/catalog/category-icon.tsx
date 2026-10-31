import {
  Box,
  CircuitBoard,
  Cpu,
  Fan,
  Gpu,
  HardDrive,
  MemoryStick,
  Package,
  PlugZap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  memory: MemoryStick,
  storage: HardDrive,
  gpu: Gpu,
  case: Box,
  psu: PlugZap,
  cooler: Fan,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? Package;
  return <Icon aria-hidden="true" className={className} />;
}
