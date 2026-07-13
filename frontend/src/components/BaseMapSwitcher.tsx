import { ChevronDown } from "lucide-react";
import { BASEMAPS } from "../lib/basemaps";

type Props = {
  baseId: string;
  opacity: number;
  open: boolean;
  onToggle: () => void;
  onBaseChange: (id: string) => void;
  onOpacityChange: (opacity: number) => void;
};

export default function BaseMapSwitcher({
  baseId,
  opacity,
  open,
  onToggle,
  onBaseChange,
  onOpacityChange,
}: Props) {
  const active = BASEMAPS.find((b) => b.id === baseId);

  return (
    <div className="w-[min(100vw-2rem,16rem)] rounded-xl border border-white/10 bg-ink-950/50 backdrop-blur-md">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-white">Base Map</span>
        <span className="flex items-center gap-2">
          <span className="max-w-[6rem] truncate rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-300">
            {active?.name.split("(")[0].trim()}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onBaseChange(b.id)}
                className={`overflow-hidden rounded-lg border text-left transition ${
                  baseId === b.id
                    ? "border-brand-500 ring-1 ring-brand-500"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <div className="h-8 w-full" style={{ background: b.thumb }} />
                <div className="px-1.5 py-1">
                  <div className="truncate text-[10px] font-semibold text-white">{b.group}</div>
                  <div className="truncate text-[9px] text-slate-400">{b.name.split("(")[0]}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Base opacity</span>
              <span className="text-slate-300">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
