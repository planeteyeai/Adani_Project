import { Circle, CircleMarker, Tooltip } from "react-leaflet";
import { FLOOD_COLORS, type FloodPoint, type FloodScene } from "../lib/flood";

type Props = {
  scene: FloodScene | null;
};

type Cluster = {
  points: FloodPoint[];
  lat: number;
  lon: number;
  radiusM: number;
};

/** ~distance in meters (good enough for small Bihar extents). */
function approxDistM(a: FloodPoint, b: FloodPoint): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

/** Simple distance clustering so each halo sits on a real group of samples. */
function clusterPoints(points: FloodPoint[], linkM = 1200): Cluster[] {
  const unused = points.map((_, i) => i);
  const clusters: Cluster[] = [];

  while (unused.length) {
    const seed = unused.pop()!;
    const members = [seed];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = unused.length - 1; i >= 0; i--) {
        const idx = unused[i];
        const p = points[idx];
        if (members.some((m) => approxDistM(points[m], p) <= linkM)) {
          members.push(idx);
          unused.splice(i, 1);
          grew = true;
        }
      }
    }

    const pts = members.map((i) => points[i]);
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const center = { lat, lon, class: "water" as const };
    let maxR = 180;
    for (const p of pts) {
      maxR = Math.max(maxR, approxDistM(center, p) + 80);
    }
    clusters.push({ points: pts, lat, lon, radiusM: Math.min(maxR, 2500) });
  }

  return clusters;
}

/** Map layer: permanent water (blue) + inundation/flood (orange) sample points. */
export default function FloodLayer({ scene }: Props) {
  if (!scene?.points.length) return null;

  const clusters = clusterPoints(scene.points);

  return (
    <>
      {clusters.map((c, ci) => (
        <Circle
          key={`${scene.date}-halo-${ci}`}
          center={[c.lat, c.lon]}
          radius={c.radiusM}
          pathOptions={{
            color: "#7c2d12",
            weight: 2,
            dashArray: "4 6",
            fillColor: FLOOD_COLORS.water,
            fillOpacity: 0.05,
            opacity: 0.95,
          }}
        />
      ))}
      {scene.points.map((p, i) => {
        const isFlood = p.class === "flood";
        const color = isFlood ? FLOOD_COLORS.flood : FLOOD_COLORS.water;
        return (
          <CircleMarker
            key={`${scene.date}-${i}-${p.lat}-${p.lon}`}
            center={[p.lat, p.lon]}
            radius={isFlood ? 7 : 5}
            pathOptions={{
              color: "#ffffff",
              weight: 1.5,
              fillColor: color,
              fillOpacity: isFlood ? 0.9 : 0.75,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95} className="geovision-tooltip">
              <span className="font-semibold" style={{ color }}>
                {isFlood ? "Flood / inundation" : "Permanent water"}
              </span>
              <br />
              <span className="text-slate-400">{scene.date}</span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
