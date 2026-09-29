import { useMemo, useState } from "react";
import { LandPlot, X } from "lucide-react";
import {
  formatChainageKm,
  landBlockColor,
  type LandAcquisitionData,
} from "../lib/landAcquisition";

type Props = {
  data: LandAcquisitionData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
};

export default function LandAcquisitionPanel({
  data,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const maxHa = useMemo(
    () => Math.max(...data.blocks.map((b) => b.area_ha), 0.01),
    [data.blocks],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.blocks.filter((b) => {
      if (!q) return true;
      return (
        b.id.toLowerCase().includes(q) ||
        String(b.from_km).includes(q) ||
        String(b.to_km).includes(q)
      );
    });
  }, [data.blocks, query]);

  return (
    <div
      className="max-h-[44vh] shrink-0 overflow-hidden border-t border-teal-500/20 bg-ink-900/95 backdrop-blur-xl"
      role="region"
      aria-label="Land requirement by chainage"
    >
      <div className="px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
            <LandPlot className="h-3.5 w-3.5 text-teal-400" />
            <h3 className="text-[11px] font-bold text-white">Land requirement by chainage</h3>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {data.block_count} blocks · every {data.step_km} km
            </span>
            <span className="rounded bg-teal-500/15 px-2 py-0.5 font-semibold text-teal-300">
              Total {data.total_area_ha.toFixed(2)} ha
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-white/10"
          >
            <span className="inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Hide
            </span>
          </button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          <span>
            Outline: {data.source_outline.replace("Model / ", "")}
          </span>
          {data.outline_area_ha != null && (
            <>
              <span>·</span>
              <span>Full outline polygon {data.outline_area_ha.toFixed(1)} ha</span>
            </>
          )}
          <span>·</span>
          <span>
            Ch {formatChainageKm(data.chainage_min_km)} –{" "}
            {formatChainageKm(data.chainage_max_km)}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1 text-teal-300">
            <span className="h-2 w-4 rounded-sm bg-[#38e1c6]" /> Lower area
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300">
            <span className="h-2 w-4 rounded-sm bg-[#f59e0b]" /> Mid
          </span>
          <span className="inline-flex items-center gap-1 text-rose-300">
            <span className="h-2 w-4 rounded-sm bg-[#f43f5e]" /> Higher area
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter chainage…"
            className="ml-auto rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-500/40"
          />
        </div>

        <div className="max-h-[28vh] overflow-auto rounded border border-white/10">
          <table className="min-w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-ink-950 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Chainage</th>
                <th className="px-2 py-1.5 font-semibold">Avg width</th>
                <th className="px-2 py-1.5 font-semibold">Area</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const active = b.id === selectedId;
                const color = landBlockColor(b.area_ha, maxHa);
                return (
                  <tr
                    key={b.id}
                    onClick={() => onSelect(active ? null : b.id)}
                    className={`cursor-pointer border-t border-white/5 transition ${
                      active ? "bg-teal-500/15" : "hover:bg-white/5"
                    }`}
                  >
                    <td className="px-2 py-1.5 font-medium text-white">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ background: color }}
                        />
                        {formatChainageKm(b.from_km)} – {formatChainageKm(b.to_km)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-300">
                      {b.avg_width_m.toFixed(1)} m
                    </td>
                    <td className="px-2 py-1.5 tabular-nums font-semibold text-teal-200">
                      {b.area_ha.toFixed(3)} ha
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-slate-500">
                    No blocks match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[9px] leading-snug text-slate-500">
          Area = chainage block width (perpendicular cuts onto Polyline [236ED8] outline) ×
          length. Where only one outline side is found, the opposite side is mirrored. This is
          geometric RoW area — not legal acquisition status.
        </p>
      </div>
    </div>
  );
}
