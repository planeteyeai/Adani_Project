import {
  Flame, Milestone, TrainFront, Zap, Sun, Waves, Mountain, Building2, TramFront, Plane,
  Upload, Satellite, Ruler, ShieldAlert, FileText, LineChart, Contrast, TriangleRight,
  Layers, Map, Layers3, Split, Truck, Bot, Gauge, FileBarChart, Globe2, ArrowRight,
  Play, type LucideIcon,
} from "lucide-react";

// Explicit registry keeps the bundle tree-shakeable and avoids dynamic-name pitfalls.
const REGISTRY: Record<string, LucideIcon> = {
  Flame, Milestone, TrainFront, Zap, Sun, Waves, Mountain, Building2, TramFront, Plane,
  Upload, Satellite, Ruler, ShieldAlert, FileText, LineChart, Contrast, TriangleRight,
  Layers, Map, Layers3, Split, Truck, Bot, Gauge, FileBarChart, Globe2, ArrowRight, Play,
};

export function Icon({
  name,
  className,
  size,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const Cmp = REGISTRY[name] ?? Globe2;
  return <Cmp className={className} size={size} />;
}
