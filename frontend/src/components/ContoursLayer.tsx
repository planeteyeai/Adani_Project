import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";
import {
  contourColor,
  contoursToLines,
  type ContoursData,
} from "../lib/contours";

type Props = {
  data: ContoursData;
  /** Line weight in px. */
  weight?: number;
  opacity?: number;
  /** Pulse/glow the layer while its active-layer card is open. */
  blink?: boolean;
};

/**
 * Canvas contour overlay — draws only lines intersecting the viewport.
 * Coloured by elevation (blue → teal → amber).
 */
export default function ContoursLayer({ data, weight = 1.25, opacity = 0.85, blink = false }: Props) {
  const map = useMap();
  const lines = useMemo(() => contoursToLines(data), [data]);
  const elevMin = data.elev_min ?? 40;
  const elevMax = data.elev_max ?? 70;

  useEffect(() => {
    if (!lines.length) return;

    const canvas = L.DomUtil.create(
      "canvas",
      `leaflet-zoom-animated${blink ? " active-layer-canvas-blink" : ""}`,
    ) as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    map.getPanes().overlayPane.appendChild(canvas);
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "420";

    let raf = 0;
    let size = map.getSize();

    const positionCanvas = () => {
      size = map.getSize();
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size.x * dpr);
      canvas.height = Math.round(size.y * dpr);
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      raf = 0;
      positionCanvas();
      ctx.clearRect(0, 0, size.x, size.y);
      ctx.lineWidth = weight;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = opacity;

      const b = map.getBounds().pad(0.05);
      const south = b.getSouth();
      const north = b.getNorth();
      const west = b.getWest();
      const east = b.getEast();
      const zoom = map.getZoom();
      // At low zoom, skip every Nth line to keep pans smooth.
      const stride = zoom < 12 ? 3 : zoom < 14 ? 2 : 1;

      let drawn = 0;
      for (let i = 0; i < lines.length; i += stride) {
        const line = lines[i];
        const [minLon, minLat, maxLon, maxLat] = line.bbox;
        if (maxLon < west || minLon > east || maxLat < south || minLat > north) continue;

        ctx.strokeStyle = contourColor(line.elevation, elevMin, elevMax);
        ctx.beginPath();
        let started = false;
        for (const [lon, lat] of line.coords) {
          const p = map.latLngToContainerPoint([lat, lon]);
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        if (started) {
          ctx.stroke();
          drawn += 1;
        }
      }

      // Elevation labels when zoomed in and sparse enough
      if (zoom >= 15 && drawn < 120) {
        ctx.globalAlpha = 0.9;
        ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = 0; i < lines.length; i += stride) {
          const line = lines[i];
          if (line.elevation == null) continue;
          const [minLon, minLat, maxLon, maxLat] = line.bbox;
          if (maxLon < west || minLon > east || maxLat < south || minLat > north) continue;
          const mid = line.coords[Math.floor(line.coords.length / 2)];
          if (!mid) continue;
          const p = map.latLngToContainerPoint([mid[1], mid[0]]);
          const label = String(line.elevation);
          const tw = ctx.measureText(label).width + 6;
          ctx.fillStyle = "rgba(10,17,32,0.65)";
          ctx.fillRect(p.x - tw / 2, p.y - 7, tw, 14);
          ctx.fillStyle = "#e2e8f0";
          ctx.fillText(label, p.x, p.y);
        }
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    positionCanvas();
    draw();
    map.on("move zoom viewreset", schedule);
    map.on("zoomanim", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off("move zoom viewreset", schedule);
      map.off("zoomanim", schedule);
      canvas.remove();
    };
  }, [map, lines, elevMin, elevMax, weight, opacity, blink]);

  return null;
}
