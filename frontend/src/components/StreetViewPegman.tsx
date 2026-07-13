import { useEffect, useRef, useState } from "react";
import type L from "leaflet";

type Props = {
  map: L.Map | null;
  onDrop: (lat: number, lon: number) => void;
  /** Fired when pegman pick-up / drag starts or ends — used to show coverage. */
  onDraggingChange?: (dragging: boolean) => void;
};

/** Google Maps–style pegman: drag onto the map to open Street View. */
export default function StreetViewPegman({ map, onDrop, onDraggingChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [overMap, setOverMap] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    onDraggingChange?.(dragging);
  }, [dragging, onDraggingChange]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!map) {
        setOverMap(false);
        return;
      }
      const rect = map.getContainer().getBoundingClientRect();
      setOverMap(
        e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom,
      );
    };

    const onUp = (e: PointerEvent) => {
      activeRef.current = false;
      setDragging(false);
      setPos(null);
      setOverMap(false);

      if (!map) return;
      const rect = map.getContainer().getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) return;

      const point = map.mouseEventToLatLng(e as unknown as MouseEvent);
      onDrop(point.lat, point.lng);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, map, onDrop]);

  useEffect(() => {
    if (!map) return;
    const el = map.getContainer();
    if (dragging) {
      el.style.cursor = overMap ? "copy" : "grabbing";
    } else {
      el.style.cursor = "";
    }
    return () => {
      el.style.cursor = "";
    };
  }, [dragging, overMap, map]);

  return (
    <>
      <button
        type="button"
        title="Drag onto a blue Street View road"
        onPointerDown={(e) => {
          e.preventDefault();
          activeRef.current = true;
          setDragging(true);
          setPos({ x: e.clientX, y: e.clientY });
        }}
        className={`grid h-10 w-10 place-items-center rounded-xl border backdrop-blur-xl transition ${
          dragging
            ? "border-amber-400 bg-amber-500/25 text-amber-200"
            : "border-white/10 bg-ink-900/80 text-white hover:bg-white/10"
        }`}
      >
        <PegmanIcon className="h-6 w-6" />
      </button>

      {dragging && pos && (
        <div
          className="pointer-events-none fixed z-[10000] -translate-x-1/2 -translate-y-full"
          style={{ left: pos.x, top: pos.y - 4 }}
        >
          <div
            className={`transition-transform ${overMap ? "scale-125 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "scale-100 opacity-80"}`}
          >
            <PegmanIcon className="h-10 w-10" />
          </div>
          {overMap && (
            <div className="mt-1 whitespace-nowrap rounded bg-ink-950/80 px-1.5 py-0.5 text-center text-[9px] font-semibold text-amber-300">
              Drop on a blue road
            </div>
          )}
        </div>
      )}
    </>
  );
}

function PegmanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 48" className={className} aria-hidden>
      <circle cx="16" cy="8" r="6.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.2" />
      <circle cx="13.5" cy="7.5" r="1.1" fill="#0f172a" />
      <circle cx="18.5" cy="7.5" r="1.1" fill="#0f172a" />
      <path
        d="M10 15.5c0-1.2 1.2-2 2.8-2h6.4c1.6 0 2.8.8 2.8 2v11.2c0 .9-.7 1.6-1.6 1.6h-9c-.9 0-1.6-.7-1.6-1.6V15.5z"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="1"
      />
      <path
        d="M9.5 17.5c-2.2 1.2-3.8 3.4-3.8 5.2 0 .6.5 1 1 1s1-.4 1-1c0-1.1 1-2.6 2.4-3.5"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M22.5 17.5c2.2 1.2 3.8 3.4 3.8 5.2 0 .6-.5 1-1 1s-1-.4-1-1c0-1.1-1-2.6-2.4-3.5"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M13 28.2v12.5c0 1.1-.7 2-1.6 2s-1.6-.9-1.6-2"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M19 28.2v12.5c0 1.1.7 2 1.6 2s1.6-.9 1.6-2"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
