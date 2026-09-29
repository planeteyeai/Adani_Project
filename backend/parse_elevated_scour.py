"""Parse Elevated Section Scour Screening.xlsx into JSON for the frontend Elevated Viaduct layer."""
from __future__ import annotations

import json
import os

import openpyxl

SRC = r"C:\Users\Kunal.Desale\Downloads\Elevated Section Scour Screening.xlsx"
OUT = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "elevated_scour.json"
)

# Prefer corrected ground elevation when present.
KEYS = [
    ("id", "ID"),
    ("chainage_km", "Chainage_km"),
    ("latitude", "Latitude"),
    ("longitude", "Longitude"),
    ("ground_elev_m", "Ground_Elev_m_SRTM"),
    ("ground_elev_corrected_m", "Ground_Elev_Corrected_m"),
    ("seasons_wet_of_4", "Seasons_Wet_of_4"),
    ("hydraulic_zone", "Hydraulic_Zone"),
    ("flow", "Flow"),
    ("d_pre_m", "D_Pre_m"),
    ("d_post_m", "D_Post_m"),
    ("v_pre_ms", "V_Pre_ms"),
    ("v_post_ms", "V_Post_ms"),
    ("q_post_m3sm", "q_Post_m3sm"),
    ("scour_min_m", "Scour_Min_m"),
    ("scour_max_m", "Scour_Max_m"),
]


def _num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse(path: str) -> dict:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise SystemExit("Empty workbook")
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    col = {name: i for i, name in enumerate(header)}

    points: list[dict] = []
    for row in rows[1:]:
        if not row or row[0] is None:
            continue
        lat = _num(row[col["Latitude"]])
        lon = _num(row[col["Longitude"]])
        ch = _num(row[col["Chainage_km"]])
        if lat is None or lon is None or ch is None:
            continue
        pt: dict = {
            "id": str(row[col["ID"]]).strip(),
            "chainage_km": ch,
            "latitude": lat,
            "longitude": lon,
        }
        for out_key, src_key in KEYS:
            if out_key in pt:
                continue
            if src_key not in col:
                continue
            raw = row[col[src_key]]
            if out_key in (
                "hydraulic_zone",
                "flow",
                "id",
            ):
                pt[out_key] = str(raw).strip() if raw is not None else None
            else:
                pt[out_key] = _num(raw)
        points.append(pt)

    points.sort(key=lambda p: p["chainage_km"])

    # Split into contiguous stretches by hydraulic zone for colouring / popups.
    stretches: list[dict] = []
    if points:
        start = 0
        for i in range(1, len(points) + 1):
            same = (
                i < len(points)
                and (points[i].get("hydraulic_zone") or "")
                == (points[start].get("hydraulic_zone") or "")
            )
            if same:
                continue
            chunk = points[start:i]
            coords = [[p["longitude"], p["latitude"]] for p in chunk]
            if len(coords) >= 2:
                stretches.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "id": f"ELV-{len(stretches) + 1:03d}",
                            "name": f"Elevated {chunk[0]['chainage_km']:.2f}–{chunk[-1]['chainage_km']:.2f} km",
                            "from_km": chunk[0]["chainage_km"],
                            "to_km": chunk[-1]["chainage_km"],
                            "length_km": round(
                                chunk[-1]["chainage_km"] - chunk[0]["chainage_km"], 3
                            ),
                            "hydraulic_zone": chunk[0].get("hydraulic_zone"),
                            "point_count": len(chunk),
                            "scour_min_m": min(
                                (p["scour_min_m"] for p in chunk if p.get("scour_min_m") is not None),
                                default=None,
                            ),
                            "scour_max_m": max(
                                (p["scour_max_m"] for p in chunk if p.get("scour_max_m") is not None),
                                default=None,
                            ),
                        },
                        "geometry": {"type": "LineString", "coordinates": coords},
                    }
                )
            start = i

    return {
        "title": "Elevated Section Scour Screening",
        "description": "Elevated / structure stretches with scour screening along the corridor",
        "count": len(points),
        "stretch_count": len(stretches),
        "from_km": points[0]["chainage_km"] if points else None,
        "to_km": points[-1]["chainage_km"] if points else None,
        "points": points,
        "type": "FeatureCollection",
        "features": stretches,
    }


def main() -> None:
    data = parse(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(
        f"Wrote {data['count']} points / {data['stretch_count']} stretches "
        f"({data['from_km']}–{data['to_km']} km) -> {OUT}"
    )


if __name__ == "__main__":
    main()
