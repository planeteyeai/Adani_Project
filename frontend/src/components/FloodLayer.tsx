import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import type { FloodScene } from "../lib/flood";

type Props = {
  scene: FloodScene | null;
};

type HeatLayerFactory = (
  latlngs: [number, number, number][],
  options?: Record<string, unknown>,
) => L.Layer;

// Permanent water registers as a mild signal; flood/inundation burns hot.
const WATER_WEIGHT = 0.45;
const FLOOD_WEIGHT = 1;

// Combined view (zoomed out): blue (open water) → cyan → amber → red.
const COMBINED_GRADIENT: Record<number, string> = {
  0.15: "#1d4ed8",
  0.35: "#0ea5e9",
  0.55: "#22d3ee",
  0.75: "#f59e0b",
  1.0: "#ef4444",
};

// Distinguished view (zoomed in): permanent water — cool blue ramp.
const WATER_GRADIENT: Record<number, string> = {
  0.2: "#1e3a8a",
  0.5: "#2563eb",
  0.8: "#38bdf8",
  1.0: "#7dd3fc",
};

// Distinguished view (zoomed in): flood / inundation — hot red-orange ramp.
const FLOOD_GRADIENT: Record<number, string> = {
  0.2: "#7f1d1d",
  0.5: "#dc2626",
  0.8: "#f97316",
  1.0: "#fbbf24",
};

const HEAT_OPTIONS = {
  radius: 17,
  blur: 10,
  maxZoom: 17,
  max: 1,
  minOpacity: 0.10,
} as const;

// Overall transparency applied to the whole heat canvas (dims hot spots too).
const LAYER_OPACITY = 0.80;

function applyOpacity(layer: L.Layer) {
  const canvas = (layer as unknown as { _canvas?: HTMLCanvasElement })._canvas;
  if (canvas) canvas.style.opacity = String(LAYER_OPACITY);
}

const SCALE_STEPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
];

/** Rounded ground-scale (m) across 80px — matches the on-map scale label. */
function scaleMeters(lat: number, zoom: number, targetPx = 80): number {
  const metersPerPx =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const raw = metersPerPx * targetPx;
  let best = SCALE_STEPS[0];
  for (const s of SCALE_STEPS) {
    if (s <= raw) best = s;
    else break;
  }
  return best;
}

/**
 * Map layer: flood / permanent-water heat map for the selected date.
 * - Zoomed out (scale label > 100 m): one combined intensity heat map.
 * - Zoomed in (scale label ≤ 100 m): two heat maps that distinguish
 *   permanent water (blue) from flood / inundation (red-orange).
 */
export default function FloodLayer({ scene }: Props) {
  const map = useMap();
  const [distinguish, setDistinguish] = useState(false);

  useEffect(() => {
    const update = () => {
      const scale = scaleMeters(map.getCenter().lat, map.getZoom());
      setDistinguish(scale <= 100);
    };
    update();
    map.on("zoom zoomend move moveend", update);
    return () => {
      map.off("zoom zoomend move moveend", update);
    };
  }, [map]);

  const { combined, waterPoints, floodPoints } = useMemo(() => {
    const water: [number, number, number][] = [];
    const flood: [number, number, number][] = [];
    const all: [number, number, number][] = [];
    for (const p of scene?.points ?? []) {
      const isFlood = p.class === "flood";
      all.push([p.lat, p.lon, isFlood ? FLOOD_WEIGHT : WATER_WEIGHT]);
      (isFlood ? flood : water).push([p.lat, p.lon, 1]);
    }
    return { combined: all, waterPoints: water, floodPoints: flood };
  }, [scene]);

  useEffect(() => {
    const heatLayer = (L as typeof L & { heatLayer: HeatLayerFactory }).heatLayer;
    const layers: L.Layer[] = [];

    if (distinguish) {
      if (waterPoints.length) {
        layers.push(
          heatLayer(waterPoints, { ...HEAT_OPTIONS, gradient: WATER_GRADIENT }).addTo(map),
        );
      }
      if (floodPoints.length) {
        layers.push(
          heatLayer(floodPoints, { ...HEAT_OPTIONS, gradient: FLOOD_GRADIENT }).addTo(map),
        );
      }
    } else if (combined.length) {
      layers.push(
        heatLayer(combined, { ...HEAT_OPTIONS, gradient: COMBINED_GRADIENT }).addTo(map),
      );
    }

    for (const layer of layers) applyOpacity(layer);

    return () => {
      for (const layer of layers) map.removeLayer(layer);
    };
  }, [map, distinguish, combined, waterPoints, floodPoints]);

  return null;
}
