import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";

type TickLine = { coords: number[][]; stroke: string };

type StationPoint = {
  name: string;
  lat: number;
  lon: number;
};

type PreparedStation = {
  name: string;
  lat: number;
  lon: number;
  /** Absolute chainage in metres along the corridor. */
  chainageM: number;
};

/** Minimum spacing between shown labels by zoom (metres along chainage). */
function chainageStepM(zoom: number): number {
  if (zoom >= 17) return 20;
  if (zoom >= 16) return 50;
  if (zoom >= 15) return 100;
  if (zoom >= 14) return 200;
  if (zoom >= 13) return 500;
  return 1000;
}

function maxLabelsForZoom(zoom: number): number {
  if (zoom >= 16) return 220;
  if (zoom >= 15) return 160;
  if (zoom >= 14) return 120;
  return 90;
}

const MAX_TICKS = 400;

/**
 * Thin by unique chainage value, but keep every marker at a kept chainage
 * (LHS/RHS duplicates are preserved).
 */
function thinStations(
  stations: PreparedStation[],
  stepM: number,
  maxLabels: number,
): PreparedStation[] {
  if (!stations.length) return [];
  if (stepM <= 0) return stations.slice(0, maxLabels);

  const uniqueChainages: number[] = [];
  for (const s of stations) {
    if (
      !uniqueChainages.length ||
      uniqueChainages[uniqueChainages.length - 1] !== s.chainageM
    ) {
      uniqueChainages.push(s.chainageM);
    }
  }

  const keptChainages = new Set<number>();
  let lastKept = -Infinity;
  for (let i = 0; i < uniqueChainages.length; i++) {
    const ch = uniqueChainages[i];
    const isFirst = i === 0;
    const isLast = i === uniqueChainages.length - 1;
    const isSecondLast = i === uniqueChainages.length - 2;
    const wholeKm = ch % 1000 === 0;
    const farEnough = ch - lastKept >= stepM - 0.5;

    if (stepM >= 1000 && !isFirst && !isLast && !isSecondLast && !wholeKm) continue;

    if (
      isFirst ||
      isLast ||
      isSecondLast ||
      farEnough ||
      (wholeKm && ch - lastKept >= stepM * 0.5)
    ) {
      keptChainages.add(ch);
      lastKept = ch;
    }
  }

  // Cap unique chainages while preserving start / second-last / last.
  if (keptChainages.size > maxLabels) {
    const ordered = uniqueChainages.filter((ch) => keptChainages.has(ch));
    const capped = new Set<number>();
    capped.add(ordered[0]);
    if (ordered.length >= 2) capped.add(ordered[ordered.length - 1]);
    if (ordered.length >= 3) capped.add(ordered[ordered.length - 2]);
    const middleEnd = Math.max(1, ordered.length - 2);
    const stride = Math.ceil((middleEnd - 1) / Math.max(1, maxLabels - 3));
    for (let i = stride; i < middleEnd; i += stride) {
      capped.add(ordered[i]);
    }
    return stations.filter((s) => capped.has(s.chainageM));
  }

  return stations.filter((s) => keptChainages.has(s.chainageM));
}

/**
 * High-performance chainage overlay:
 * - Canvas polylines (not one React layer per tick)
 * - Viewport + zoom culling
 * - DivIcon badges instead of permanent Leaflet tooltips
 */
export default function ChainageLayer({
  ticks,
  stations,
  showTicks,
  showLabels,
  blink = false,
}: {
  ticks: TickLine[];
  stations: StationPoint[];
  showTicks: boolean;
  showLabels: boolean;
  blink?: boolean;
}) {
  const map = useMap();
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const svgRenderer = useMemo(() => L.svg({ padding: 0.5 }), []);

  const preparedTicks = useMemo(
    () =>
      ticks.map((t) => {
        const a = t.coords[0];
        const b = t.coords[1] ?? t.coords[0];
        return {
          positions: [
            [a[1], a[0]],
            [b[1], b[0]],
          ] as [L.LatLngExpression, L.LatLngExpression],
          color: t.stroke || "#e2e8f0",
          mid: L.latLng((a[1] + b[1]) / 2, (a[0] + b[0]) / 2),
        };
      }),
    [ticks],
  );

  const preparedStations = useMemo(() => {
    const list: PreparedStation[] = [];
    for (const p of stations) {
      const m = p.name.match(/^(\d+)\+(\d+)$/);
      if (!m) continue;
      const km = Number(m[1]);
      const metres = Number(m[2]);
      list.push({
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        chainageM: km * 1000 + metres,
      });
    }
    return list.sort((a, b) => a.chainageM - b.chainageM);
  }, [stations]);

  useEffect(() => {
    if (!showTicks && !showLabels) return;

    const group = L.layerGroup().addTo(map);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;
    const renderer = blink ? svgRenderer : canvasRenderer;

    const rebuild = () => {
      group.clearLayers();
      const zoom = map.getZoom();
      const bounds = map.getBounds().pad(0.25);
      const step = chainageStepM(zoom);

      if (showTicks) {
        const tickStride = zoom >= 16 ? 1 : zoom >= 15 ? 2 : zoom >= 14 ? 3 : zoom >= 13 ? 5 : 10;
        let drawn = 0;
        for (let i = 0; i < preparedTicks.length; i++) {
          if (drawn >= MAX_TICKS) break;
          if (i % tickStride !== 0) continue;
          const t = preparedTicks[i];
          if (!bounds.contains(t.mid)) continue;
          L.polyline(t.positions, {
            color: t.color,
            weight: blink ? 2 : 1,
            opacity: 0.9,
            interactive: false,
            renderer,
            lineCap: "butt",
            className: blink ? "active-layer-blink" : undefined,
          }).addTo(group);
          drawn++;
        }
      }

      if (showLabels) {
        const inView = preparedStations.filter((s) => bounds.contains([s.lat, s.lon]));
        const list = thinStations(inView, step, maxLabelsForZoom(zoom));
        for (const s of list) {
          const icon = L.divIcon({
            className: `geovision-chainage-icon${blink ? " active-layer-marker-blink" : ""}`,
            html: `<span class="geovision-chainage-badge">${s.name}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 8],
          });
          L.marker([s.lat, s.lon], {
            icon,
            interactive: false,
            keyboard: false,
          }).addTo(group);
        }
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(rebuild);
      }, 60);
    };

    rebuild();
    map.on("moveend", schedule);
    map.on("zoomend", schedule);

    return () => {
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      group.clearLayers();
      map.removeLayer(group);
    };
  }, [
    map,
    preparedTicks,
    preparedStations,
    showTicks,
    showLabels,
    canvasRenderer,
    svgRenderer,
    blink,
  ]);

  return null;
}
