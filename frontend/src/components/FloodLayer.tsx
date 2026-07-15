import { CircleMarker, Tooltip } from "react-leaflet";
import { FLOOD_COLORS, type FloodScene } from "../lib/flood";

type Props = {
  scene: FloodScene | null;
};

/** Map layer: permanent water (blue) + inundation/flood (orange) sample points. */
export default function FloodLayer({ scene }: Props) {
  if (!scene?.points.length) return null;

  return (
    <>
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
