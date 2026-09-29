"""Parse Design_HFL.xlsx into frontend/public/ground_scour.json (Analysis layer)."""
from __future__ import annotations

import json
import os
import shutil

import openpyxl

ROOT = os.path.dirname(__file__)
DEFAULT_SRC = os.path.join(ROOT, "data", "Design_HFL.xlsx")
DOWNLOADS_SRC = r"C:\Users\Kunal.Desale\Downloads\Design_HFL.xlsx"
OUT = os.path.join(ROOT, "..", "frontend", "public", "ground_scour.json")

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
    ("design_hfl_continuous_m", "Design_HFL_Continuous_m"),
]


def _num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _header_map(header: list[str]) -> dict[str, int]:
    col: dict[str, int] = {}
    for i, name in enumerate(header):
        key = str(name or "").strip()
        col[key] = i
        col[key.rstrip()] = i
    return col


def parse(path: str) -> dict:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise SystemExit("Empty workbook")

    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    col = _header_map(header)

    required = ["Latitude", "Longitude", "Chainage_km"]
    for name in required:
        if name not in col:
            raise SystemExit(f"Missing column: {name}. Found: {header}")

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
            "id": str(row[col.get("ID", 0)]).strip() if "ID" in col else f"P{len(points)+1}",
            "chainage_km": round(ch, 3),
            "latitude": lat,
            "longitude": lon,
        }
        for out_key, src_key in KEYS:
            if out_key in ("id", "chainage_km", "latitude", "longitude"):
                continue
            # tolerate trailing spaces in header names
            src = src_key if src_key in col else next(
                (h for h in col if h.strip() == src_key.strip()), None
            )
            if src is None:
                continue
            raw = row[col[src]]
            if out_key in ("hydraulic_zone", "flow"):
                pt[out_key] = str(raw).strip() if raw is not None else None
            else:
                n = _num(raw)
                pt[out_key] = round(n, 4) if n is not None else None
        points.append(pt)

    points.sort(key=lambda p: p["chainage_km"])

    # Contiguous stretches by hydraulic zone (line overlay + summary)
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
                scour_mins = [p["scour_min_m"] for p in chunk if p.get("scour_min_m") is not None]
                scour_maxs = [p["scour_max_m"] for p in chunk if p.get("scour_max_m") is not None]
                hfl_vals = [
                    p["design_hfl_continuous_m"]
                    for p in chunk
                    if p.get("design_hfl_continuous_m") is not None
                ]
                stretches.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "id": f"GS-{len(stretches) + 1:03d}",
                            "name": (
                                f"Ground scour {chunk[0]['chainage_km']:.2f}–"
                                f"{chunk[-1]['chainage_km']:.2f} km"
                            ),
                            "from_km": chunk[0]["chainage_km"],
                            "to_km": chunk[-1]["chainage_km"],
                            "length_km": round(
                                chunk[-1]["chainage_km"] - chunk[0]["chainage_km"], 3
                            ),
                            "hydraulic_zone": chunk[0].get("hydraulic_zone"),
                            "point_count": len(chunk),
                            "scour_min_m": min(scour_mins) if scour_mins else None,
                            "scour_max_m": max(scour_maxs) if scour_maxs else None,
                            "design_hfl_min_m": min(hfl_vals) if hfl_vals else None,
                            "design_hfl_max_m": max(hfl_vals) if hfl_vals else None,
                        },
                        "geometry": {"type": "LineString", "coordinates": coords},
                    }
                )
            start = i

    scour_all = [p["scour_max_m"] for p in points if p.get("scour_max_m") is not None]
    hfl_all = [
        p["design_hfl_continuous_m"]
        for p in points
        if p.get("design_hfl_continuous_m") is not None
    ]

    return {
        "title": "Ground Scour",
        "description": "Design HFL and ground scour screening along the corridor",
        "count": len(points),
        "stretch_count": len(stretches),
        "from_km": points[0]["chainage_km"] if points else None,
        "to_km": points[-1]["chainage_km"] if points else None,
        "scour_min_m": min(scour_all) if scour_all else None,
        "scour_max_m": max(scour_all) if scour_all else None,
        "design_hfl_min_m": min(hfl_all) if hfl_all else None,
        "design_hfl_max_m": max(hfl_all) if hfl_all else None,
        "points": points,
        "type": "FeatureCollection",
        "features": stretches,
    }


def main() -> None:
    src = os.environ.get("GROUND_SCOUR_SRC")
    if not src:
        if os.path.isfile(DOWNLOADS_SRC):
            os.makedirs(os.path.dirname(DEFAULT_SRC), exist_ok=True)
            shutil.copy2(DOWNLOADS_SRC, DEFAULT_SRC)
            src = DEFAULT_SRC
        elif os.path.isfile(DEFAULT_SRC):
            src = DEFAULT_SRC
        else:
            raise SystemExit(f"Source not found: {DOWNLOADS_SRC}")

    data = parse(src)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(
        f"Wrote {data['count']} points / {data['stretch_count']} stretches "
        f"({data['from_km']}–{data['to_km']} km) "
        f"scour {data['scour_min_m']}–{data['scour_max_m']} m "
        f"HFL {data['design_hfl_min_m']}–{data['design_hfl_max_m']} m -> {OUT}"
    )


if __name__ == "__main__":
    main()
