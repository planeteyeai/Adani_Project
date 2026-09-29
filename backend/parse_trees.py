"""Parse tree inventory Excel into JSON for the frontend map overlay."""
from __future__ import annotations

import json
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "data" / "trees_final_no_water.xlsx"
OUT = ROOT.parent / "frontend" / "public" / "trees.json"


def _num(row: tuple, i: int | None) -> float | None:
    if i is None or row[i] is None:
        return None
    try:
        return float(row[i])
    except (TypeError, ValueError):
        return None


def main() -> None:
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows)]
    idx = {h.lower(): i for i, h in enumerate(headers)}

    def col(*names: str) -> int | None:
        for n in names:
            if n.lower() in idx:
                return idx[n.lower()]
        return None

    i_sr = col("sr_no")
    i_id = col("tree_id", "pin_id", "id")
    i_lat = col("latitude", "lat")
    i_lon = col("longitude", "lon", "lng")
    i_zone = col("zone")
    i_ch = col("chainage_start_m", "chainage_m", "chainage")
    i_area = col("area_m2")
    i_hmin = col("min_height_m")
    i_hmax = col("max_height_m")
    i_havg = col("avg_height_m")
    i_score = col("confidence_score", "best_detection_score")

    trees: list[dict] = []
    for row in rows:
        if not row:
            continue
        lat = _num(row, i_lat)
        lon = _num(row, i_lon)
        if lat is None or lon is None:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue

        pin = str(row[i_id]).strip() if i_id is not None and row[i_id] is not None else None
        zone = str(row[i_zone]).strip() if i_zone is not None and row[i_zone] is not None else None

        sr = None
        if i_sr is not None and row[i_sr] is not None:
            try:
                sr = int(row[i_sr])
            except (TypeError, ValueError):
                sr = None

        chainage_m = _num(row, i_ch)
        area_m2 = _num(row, i_area)
        min_h = _num(row, i_hmin)
        max_h = _num(row, i_hmax)
        avg_h = _num(row, i_havg)
        score = _num(row, i_score)

        entry: dict = {
            "id": pin or f"Tree_{len(trees) + 1:04d}",
            "sr": sr,
            "lat": round(lat, 7),
            "lon": round(lon, 7),
            "zone": zone,
            "chainage_m": chainage_m,
        }
        if area_m2 is not None:
            entry["area_m2"] = round(area_m2, 2)
        if avg_h is not None:
            entry["avg_height_m"] = round(avg_h, 2)
        if min_h is not None:
            entry["min_height_m"] = round(min_h, 2)
        if max_h is not None:
            entry["max_height_m"] = round(max_h, 2)
        if score is not None:
            entry["score"] = round(score, 3)
        trees.append(entry)

    wb.close()
    payload = {
        "title": "Trees",
        "description": "Tree inventory along the project corridor (water areas excluded)",
        "source_file": SRC.name,
        "source_sheet": ws.title,
        "count": len(trees),
        "trees": trees,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(trees)} trees -> {OUT}")
    print(f"source: {SRC.name} / {ws.title}")


if __name__ == "__main__":
    main()
