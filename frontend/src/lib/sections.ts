// Corridor route sections (interchange ramps) from Schedule-B.
// Each section is a loop/ramp anchored to a main-line interchange chainage (km).
// Geometry is derived at runtime by resolving that chainage on the alignment,
// so no separate geometry file is required.

export type CorridorSection = {
  id: number;
  name: string;
  from: string;
  to: string;
  /** Main-line chainage (km) of the parent interchange. */
  interchange_km: number;
  /** Approx ramp length (km) — used to size the section view. */
  ramp_length_km: number;
  /** Interchange group label for the dropdown. */
  group: string;
};

function splitFromTo(name: string): { from: string; to: string } {
  const [from, to] = name.split("→").map((s) => s.trim());
  return { from: from ?? name, to: to ?? "" };
}

type RawSection = {
  name: string;
  interchange_km: number;
  ramp_length_km: number;
  group: string;
};

const RAW: RawSection[] = [
  // Interchange at Km 0.000 (Start Point) — Leaf Interchange
  { name: "AIIMS → New Ganga Path", interchange_km: 0.0, ramp_length_km: 0.706, group: "Interchange @ 0.000 km (Start / Leaf)" },
  { name: "New Ganga Path → Digha Rotary", interchange_km: 0.0, ramp_length_km: 1.013, group: "Interchange @ 0.000 km (Start / Leaf)" },
  { name: "New Ganga Path → New JP Setu", interchange_km: 0.0, ramp_length_km: 0.32, group: "Interchange @ 0.000 km (Start / Leaf)" },
  { name: "New JP Setu → New Ganga Path", interchange_km: 0.0, ramp_length_km: 0.8, group: "Interchange @ 0.000 km (Start / Leaf)" },

  // Trumpet at Km 4.410
  { name: "Danapur Station → Koilwar", interchange_km: 4.41, ramp_length_km: 0.71, group: "Trumpet @ 4.410 km" },
  { name: "New Ganga Path (Digha Rotary) → Danapur Station", interchange_km: 4.41, ramp_length_km: 0.71, group: "Trumpet @ 4.410 km" },
  { name: "Koilwar → Danapur Station", interchange_km: 4.41, ramp_length_km: 1.048, group: "Trumpet @ 4.410 km" },
  { name: "Danapur Station → New Ganga Path (Digha Rotary)", interchange_km: 4.41, ramp_length_km: 0.859, group: "Trumpet @ 4.410 km" },

  // Trumpet at Km 7.520
  { name: "Shahpur → Koilwar", interchange_km: 7.52, ramp_length_km: 0.511, group: "Trumpet @ 7.520 km" },
  { name: "Digha Rotary → Shahpur", interchange_km: 7.52, ramp_length_km: 0.509, group: "Trumpet @ 7.520 km" },
  { name: "Koilwar → Shahpur", interchange_km: 7.52, ramp_length_km: 0.919, group: "Trumpet @ 7.520 km" },
  { name: "Shahpur → Digha Rotary", interchange_km: 7.52, ramp_length_km: 0.83, group: "Trumpet @ 7.520 km" },

  // Cloverleaf at Km 10.920
  { name: "Ganga Path (Koilwar) → Dighwara", interchange_km: 10.92, ramp_length_km: 0.652, group: "Cloverleaf @ 10.920 km" },
  { name: "Dighwara → Ganga Path (Digha Rotary)", interchange_km: 10.92, ramp_length_km: 0.592, group: "Cloverleaf @ 10.920 km" },
  { name: "Sherpur → Ganga Path (Koilwar)", interchange_km: 10.92, ramp_length_km: 0.64, group: "Cloverleaf @ 10.920 km" },
  { name: "Ganga Path (Digha Rotary) → Sherpur", interchange_km: 10.92, ramp_length_km: 0.581, group: "Cloverleaf @ 10.920 km" },
  { name: "Ganga Path (Koilwar) → Sherpur", interchange_km: 10.92, ramp_length_km: 0.431, group: "Cloverleaf @ 10.920 km" },
  { name: "Ganga Path (Digha Rotary) → Dighwara", interchange_km: 10.92, ramp_length_km: 0.431, group: "Cloverleaf @ 10.920 km" },
  { name: "Dighwara → Ganga Path (Koilwar)", interchange_km: 10.92, ramp_length_km: 0.431, group: "Cloverleaf @ 10.920 km" },
  { name: "Sherpur → Ganga Path (Digha Rotary)", interchange_km: 10.92, ramp_length_km: 0.431, group: "Cloverleaf @ 10.920 km" },

  // Trumpet at Km 34.532
  { name: "New Ganga Path (Digha Rotary) → Koilwar", interchange_km: 34.532, ramp_length_km: 0.212, group: "Trumpet @ 34.532 km" },
  { name: "Bhita → New Ganga Path (Digha Rotary)", interchange_km: 34.532, ramp_length_km: 0.215, group: "Trumpet @ 34.532 km" },
  { name: "Koilwar → New Ganga Path (Digha Rotary) – Service Road", interchange_km: 34.532, ramp_length_km: 0.129, group: "Trumpet @ 34.532 km" },
  { name: "New Ganga Path (Digha Rotary) → Bhita – Service Road", interchange_km: 34.532, ramp_length_km: 0.067, group: "Trumpet @ 34.532 km" },
];

export const SECTIONS: CorridorSection[] = RAW.map((r, i) => ({
  id: i + 1,
  ...splitFromTo(r.name),
  name: r.name,
  interchange_km: r.interchange_km,
  ramp_length_km: r.ramp_length_km,
  group: r.group,
}));

/** Ordered interchange groups for the dropdown. */
export const SECTION_GROUPS: string[] = SECTIONS.reduce<string[]>((acc, s) => {
  if (!acc.includes(s.group)) acc.push(s.group);
  return acc;
}, []);

export function getSectionById(id: number | null | undefined): CorridorSection | null {
  if (id == null) return null;
  return SECTIONS.find((s) => s.id === id) ?? null;
}

/** View radius (km) around the interchange point that captures the ramps. */
export function sectionRadiusKm(section: CorridorSection): number {
  return Math.max(0.8, section.ramp_length_km + 0.35);
}

/** Build a [minLon, minLat, maxLon, maxLat] bbox around a center point. */
export function bboxAround(
  lon: number,
  lat: number,
  radiusKm: number,
): [number, number, number, number] {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

export function pointInBBox(
  bbox: [number, number, number, number],
  lat: number,
  lon: number,
): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

/** Chainage window (km) around a section's interchange for filtering longitudinal data. */
export function sectionChainageWindow(section: CorridorSection): { fromKm: number; toKm: number } {
  const r = sectionRadiusKm(section);
  return {
    fromKm: Math.max(0, section.interchange_km - r),
    toKm: section.interchange_km + r,
  };
}

export function chainageInWindow(chainageKm: number, fromKm: number, toKm: number): boolean {
  return chainageKm >= fromKm - 1e-6 && chainageKm <= toKm + 1e-6;
}
