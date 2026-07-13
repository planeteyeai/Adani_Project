import { createPortal } from "react-dom";
import { ExternalLink, View, X } from "lucide-react";
import { streetViewEmbedUrl, streetViewMapsUrl } from "../lib/streetView";

type Props = {
  lat: number;
  lon: number;
  onClose: () => void;
};

export default function StreetViewModal({ lat, lon, onClose }: Props) {
  const embedUrl = streetViewEmbedUrl(lat, lon);
  const mapsUrl = streetViewMapsUrl(lat, lon);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <View className="h-5 w-5 text-brand-400" />
              <h2 className="text-lg font-bold text-white">Street View</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {lat.toFixed(5)}°N, {lon.toFixed(5)}°E
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <ExternalLink className="h-3.5 w-3.5 text-brand-400" />
              Open in Google Maps
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-[60vh] flex-1 bg-ink-950">
          <iframe
            title="Google Street View"
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; gyroscope; fullscreen"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-2 text-center text-[10px] text-slate-500">
          Drag the yellow pegman onto the map to pick another location · Imagery © Google
        </div>
      </div>
    </div>,
    document.body,
  );
}
