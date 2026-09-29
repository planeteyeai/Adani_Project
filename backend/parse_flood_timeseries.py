"""Parse flood_water_timeseries yearly Excel workbooks into frontend flood_timeseries.json.

Source layout (each .xlsx):
  - areas:  pre_date, post_date, water_area_ha, flood_area_ha
  - lat_lon: pre_date, post_date, latitude, longitude, class

Scenes store subsampled map points (for performance); water_points / flood_points
are full counts from the source.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from python_calamine import CalamineWorkbook

SRC_DIR = Path(__file__).resolve().parent / "_flood_tmp" / "flood_water_timeseries"
OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "flood_timeseries.json"

MAX_POINTS_PER_SCENE = 1000


def _date(v) -> str | None:
    if v is None:
        return None
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    return m.group(1) if m else (s[:10] if s else None)


def _f(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _subsample(points: list[dict], max_n: int = MAX_POINTS_PER_SCENE) -> list[dict]:
    if len(points) <= max_n:
        return points
    water = [p for p in points if p["class"] == "water"]
    flood = [p for p in points if p["class"] == "flood"]

    def take(arr: list[dict], n: int) -> list[dict]:
        if n <= 0:
            return []
        if n >= len(arr):
            return arr
        step = len(arr) / n
        return [arr[int(i * step)] for i in range(n)]

    if not water:
        return take(flood, max_n)
    if not flood:
        return take(water, max_n)
    n_flood = max(40, int(max_n * len(flood) / len(points)))
    n_flood = min(n_flood, len(flood), max_n - 40)
    n_water = min(len(water), max_n - n_flood)
    return take(water, n_water) + take(flood, n_flood)


def _sheet_rows(wb: CalamineWorkbook, name: str) -> list[tuple]:
    return wb.get_sheet_by_name(name).to_python(skip_empty_area=False)


def parse_workbook(path: Path) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    print(f"  reading {path.name} …", flush=True)
    wb = CalamineWorkbook.from_path(str(path))

    areas = _sheet_rows(wb, "areas")
    area_by_date: dict[str, dict] = {}
    if areas:
        headers = [str(h).strip() if h is not None else "" for h in areas[0]]
        hi = {h: i for i, h in enumerate(headers)}
        for row in areas[1:]:
            if not row:
                continue
            date = _date(row[hi["post_date"]] if "post_date" in hi else None)
            if not date:
                continue
            area_by_date[date] = {
                "date": date,
                "pre_date": _date(row[hi["pre_date"]] if "pre_date" in hi else None),
                "water_area_ha": _f(row[hi["water_area_ha"]] if "water_area_ha" in hi else None),
                "flood_area_ha": _f(row[hi["flood_area_ha"]] if "flood_area_ha" in hi else None),
            }

    lat_lon = _sheet_rows(wb, "lat_lon")
    points_by_date: dict[str, list[dict]] = {}
    if lat_lon:
        headers = [str(h).strip() if h is not None else "" for h in lat_lon[0]]
        hi = {h: i for i, h in enumerate(headers)}
        for row in lat_lon[1:]:
            if not row:
                continue
            date = _date(row[hi["post_date"]] if "post_date" in hi else None)
            lat = _f(row[hi["latitude"]] if "latitude" in hi else None)
            lon = _f(row[hi["longitude"]] if "longitude" in hi else None)
            if not date or lat is None or lon is None:
                continue
            raw_cls = row[hi["class"]] if "class" in hi else "water"
            cls = str(raw_cls or "water").strip().lower()
            if cls not in ("water", "flood"):
                cls = "water"
            points_by_date.setdefault(date, []).append(
                {"lat": round(lat, 6), "lon": round(lon, 6), "class": cls}
            )

    print(
        f"    -> {len(area_by_date)} dates, "
        f"{sum(len(v) for v in points_by_date.values()):,} points",
        flush=True,
    )
    return area_by_date, points_by_date


def main() -> None:
    if not SRC_DIR.is_dir():
        raise SystemExit(f"Source folder not found: {SRC_DIR}")

    files = sorted(SRC_DIR.glob("flood_water_timeseries*.xlsx"))
    if not files:
        raise SystemExit(f"No Excel files in {SRC_DIR}")

    area_by_date: dict[str, dict] = {}
    points_by_date: dict[str, list[dict]] = {}

    for path in files:
        a, p = parse_workbook(path)
        area_by_date.update(a)
        for date, pts in p.items():
            points_by_date.setdefault(date, []).extend(pts)

    dates = sorted(set(area_by_date) | set(points_by_date))
    scenes: dict[str, dict] = {}
    timeseries: list[dict] = []

    for date in dates:
        pts = points_by_date.get(date, [])
        water_n = sum(1 for p in pts if p["class"] == "water")
        flood_n = sum(1 for p in pts if p["class"] == "flood")
        meta = area_by_date.get(
            date,
            {
                "date": date,
                "pre_date": None,
                "water_area_ha": None,
                "flood_area_ha": None,
            },
        )
        scenes[date] = {
            "date": date,
            "pre_date": meta.get("pre_date"),
            "water_area_ha": meta.get("water_area_ha"),
            "flood_area_ha": meta.get("flood_area_ha"),
            "water_points": water_n,
            "flood_points": flood_n,
            "points": _subsample(pts),
        }
        timeseries.append(
            {
                "date": date,
                "pre_date": meta.get("pre_date"),
                "lat": None,
                "lon": None,
                "water_area_ha": meta.get("water_area_ha"),
                "flood_area_ha": meta.get("flood_area_ha"),
                "water_points": water_n,
                "flood_points": flood_n,
            }
        )

    payload = {
        "title": "Flood water time series",
        "description": "Satellite-derived water and flood extent along the corridor (ha), 2015–2026",
        "unit": "ha",
        "dates": dates,
        "timeseries": timeseries,
        "scenes": scenes,
        # Gauge / stage peaks (m) — kept in parser so regenerations retain them.
        "max_water_levels": [
            {
                "year": 2016,
                "max_water_level_m": 52.30,
                "peak_date": None,
                "peak_label": "Aug 2016",
                "note": "Severe Flood",
            },
            {
                "year": 2018,
                "max_water_level_m": 50.72,
                "peak_date": "2018-09-13",
                "peak_label": "13 Sep 2018",
                "note": None,
            },
            {
                "year": 2019,
                "max_water_level_m": 50.94,
                "peak_date": "2019-09-23",
                "peak_label": "23 Sep 2019",
                "note": None,
            },
            {
                "year": 2020,
                "max_water_level_m": 50.05,
                "peak_date": "2020-08-22",
                "peak_label": "22 Aug 2020",
                "note": None,
            },
            {
                "year": 2021,
                "max_water_level_m": 51.85,
                "peak_date": "2021-08-15",
                "peak_label": "15 Aug 2021",
                "note": None,
            },
            {
                "year": 2022,
                "max_water_level_m": 50.76,
                "peak_date": "2022-09-01",
                "peak_label": "01 Sep 2022",
                "note": None,
            },
            {
                "year": 2023,
                "max_water_level_m": 49.67,
                "peak_date": "2023-08-10",
                "peak_label": "10 Aug 2023",
                "note": None,
            },
            {
                "year": 2024,
                "max_water_level_m": 51.76,
                "peak_date": "2024-09-20",
                "peak_label": "20 Sep 2024",
                "note": None,
            },
            {
                "year": 2025,
                "max_water_level_m": 50.45,
                "peak_date": "2025-07-15",
                "peak_label": "15 Jul 2025",
                "note": None,
            },
            {
                "year": 2026,
                "max_water_level_m": 50.57,
                "peak_date": "2026-07-20",
                "peak_label": "20 Jul 2026",
                "note": None,
            },
        ],
        "reference_location": {
            "name": "Digha Ghat",
            "lat": 25.6533611,
            "lon": 85.0901944,
            "agency": "WRD Bihar · Ganga river gauge",
            "danger_level_m": 50.45,
            "datum": "River stage (m)",
            "description": (
                "Reference gauge where maximum water levels are recorded for flood "
                "monitoring along the Ganga at Patna."
            ),
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    stored = sum(len(s["points"]) for s in scenes.values())
    raw = sum(len(v) for v in points_by_date.values())
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(
        f"Wrote {len(dates)} dates · {raw:,} source points -> "
        f"{stored:,} map points ({size_mb:.1f} MB) -> {OUT}",
        flush=True,
    )


if __name__ == "__main__":
    main()
