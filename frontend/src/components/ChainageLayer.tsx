import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";

type TickLine = { coords: number[][]; stroke: string };

type StationPoint = {
  name: string;
  lat: number;
  lon: number;
};

/** Label / tick density by zoom (metres between shown stations). */
function chainageStepM(zoom: number): number {
  if (zoom >= 17) return 20;
  if (zoom >= 16) return 50;
  if (zoom >= 15) return 100;
  if (zoom >= 14) return 200;
  if (zoom >= 13) return 500;
  return 1000;
}

const MAX_LABELS = 80;
const MAX_TICKS = 200;

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

  const preparedStations = useMemo(
    () =>
      stations.map((p) => {
        const parts = p.name.split("+");
        return {
          name: p.name,
          lat: p.lat,
          lon: p.lon,
          metres: Number(parts[1] ?? 0),
        };
      }),
    [stations],
  );

  useEffect(() => {
    if (!showTicks && !showLabels) return;

    const group = L.layerGroup().addTo(map);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;
    const renderer = blink ? svgRenderer : canvasRenderer;

    const rebuild = () => {
      group.clearLayers();
      const zoom = map.getZoom();
      const bounds = map.getBounds().pad(0.2);
      const step = chainageStepM(zoom);

      if (showTicks) {
        const tickStride = zoom >= 16 ? 1 : zoom >= 15 ? 2 : zoom >= 14 ? 3 : zoom >= 13 ? 6 : 12;
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
        let list = preparedStations.filter((s) => {
          if (!bounds.contains([s.lat, s.lon])) return false;
          if (step >= 1000) return s.metres === 0;
          return s.metres % step === 0;
        });
        if (list.length > MAX_LABELS) {
          const stride = Math.ceil(list.length / MAX_LABELS);
          list = list.filter((_, i) => i % stride === 0);
        }
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
