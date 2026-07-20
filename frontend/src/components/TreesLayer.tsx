import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { TreePoint } from "../lib/trees";

const MAX_EMOJI = 1800;
const HIT_PX = 14;

function treeTooltipHtml(t: TreePoint): string {
  const chKm =
    t.chainage_m != null && Number.isFinite(t.chainage_m)
      ? `${(t.chainage_m / 1000).toFixed(2)} km`
      : null;
  const height =
    t.avg_height_m != null && Number.isFinite(t.avg_height_m)
      ? `H ${t.avg_height_m.toFixed(1)} m`
      : null;
  const area =
    t.area_m2 != null && Number.isFinite(t.area_m2)
      ? `Area ${t.area_m2.toFixed(1)} m²`
      : null;
  return [
    `<span class="font-semibold">🌳 ${t.id}</span>`,
    chKm ? `<span class="text-slate-400">Ch ${chKm}</span>` : null,
    t.zone ? `<span class="text-slate-400">${t.zone}</span>` : null,
    height || area
      ? `<span class="text-slate-400">${[height, area].filter(Boolean).join(" · ")}</span>`
      : null,
    `<span class="text-[10px] text-slate-500">${t.lat.toFixed(6)}, ${t.lon.toFixed(6)}</span>`,
  ]
    .filter(Boolean)
    .join("<br/>");
}

/**
 * Canvas tree overlay — draws only trees in the current viewport.
 * Emoji when zoomed in / sparse; green dots when dense (keeps map smooth).
 */
export default function TreesLayer({
  trees,
  interactive = true,
  blink = false,
}: {
  trees: TreePoint[];
  /** When false (e.g. measure mode), skip hover tooltips. */
  interactive?: boolean;
  /** Pulse/glow the layer while its active-layer card is open. */
  blink?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!trees.length) return;

    const canvas = L.DomUtil.create(
      "canvas",
      `leaflet-zoom-animated${blink ? " active-layer-canvas-blink" : ""}`,
    ) as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    map.getPanes().overlayPane.appendChild(canvas);
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "450";

    let visible: TreePoint[] = [];
    let screenPts: Array<{ t: TreePoint; x: number; y: number }> = [];
    let tooltip: L.Tooltip | null = null;
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

    const collectVisible = () => {
      const b = map.getBounds().pad(0.08);
      const south = b.getSouth();
      const north = b.getNorth();
      const west = b.getWest();
      const east = b.getEast();
      const out: TreePoint[] = [];
      for (const t of trees) {
        if (t.lat >= south && t.lat <= north && t.lon >= west && t.lon <= east) {
          out.push(t);
        }
      }
      visible = out;
    };

    const draw = () => {
      raf = 0;
      positionCanvas();
      collectVisible();
      ctx.clearRect(0, 0, size.x, size.y);

      const useEmoji = visible.length <= MAX_EMOJI && map.getZoom() >= 14;
      screenPts = [];

      if (useEmoji) {
        ctx.font = "16px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const t of visible) {
          const p = map.latLngToContainerPoint([t.lat, t.lon]);
          screenPts.push({ t, x: p.x, y: p.y });
          ctx.fillText("🌳", p.x, p.y);
        }
      } else {
        ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1;
        const r = map.getZoom() >= 15 ? 3.5 : map.getZoom() >= 13 ? 2.5 : 2;
        for (const t of visible) {
          const p = map.latLngToContainerPoint([t.lat, t.lon]);
          screenPts.push({ t, x: p.x, y: p.y });
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          if (r >= 3) ctx.stroke();
        }
      }
    };

    const scheduleDraw = () => {
      if (raf) return;
      raf = requestAnimationFrame(draw);
    };

    const nearestAt = (pt: L.Point): TreePoint | null => {
      let best: TreePoint | null = null;
      let bestD = HIT_PX * HIT_PX;
      for (const s of screenPts) {
        const dx = s.x - pt.x;
        const dy = s.y - pt.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = s.t;
        }
      }
      return best;
    };

    let lastTooltipId: string | null = null;
    const onMove = (e: L.LeafletMouseEvent) => {
      const hit = nearestAt(e.containerPoint);
      if (!hit) {
        if (tooltip) {
          map.closeTooltip(tooltip);
          tooltip = null;
          lastTooltipId = null;
        }
        return;
      }
      if (!tooltip) {
        tooltip = L.tooltip({
          direction: "top",
          opacity: 0.95,
          className: "geovision-tooltip",
          offset: [0, -10],
          sticky: true,
        });
      }
      if (lastTooltipId !== hit.id) {
        tooltip.setContent(treeTooltipHtml(hit));
        lastTooltipId = hit.id;
      }
      tooltip.setLatLng([hit.lat, hit.lon]);
      if (!tooltip.isOpen()) tooltip.addTo(map);
    };

    const onOut = () => {
      if (tooltip) {
        map.closeTooltip(tooltip);
        tooltip = null;
        lastTooltipId = null;
      }
    };

    map.on("move zoom viewreset resize", scheduleDraw);
    if (interactive) {
      map.on("mousemove", onMove);
      map.on("mouseout", onOut);
    }
    scheduleDraw();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off("move zoom viewreset resize", scheduleDraw);
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      if (tooltip) {
        map.closeTooltip(tooltip);
        tooltip = null;
      }
      canvas.remove();
    };
  }, [map, trees, interactive, blink]);

  return null;
}
