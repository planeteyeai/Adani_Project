"""Parse RE (reinforced-earth) wall polygons from KML into GeoJSON.

Source: RE _Wall_Locations.kml — Placemarks named e.g. "RE wall 17.48to17.87"
(the chainage range in km), each a Polygon footprint.
Output: frontend/public/re_walls.json
"""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\RE _Wall_Locations.kml"
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "re_walls.json")

RE_WALL_COLOR = "#f97316"

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")
_CH_RE = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*to\s*([0-9]+(?:\.[0-9]+)?)", re.I)


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _parse_ring(text: str) -> list[list[float]]:
    ring: list[list[float]] = []
    for token in _WS_RE.split(text.strip()):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            ring.append([round(float(parts[0]), 7), round(float(parts[1]), 7)])
        except ValueError:
            continue
    return ring


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    idx = 0
    from_vals: list[float] = []
    to_vals: list[float] = []
    coverage = 0.0

    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue

        name = None
        for child in pm:
            if _localname(child.tag) == "name" and child.text:
                name = " ".join(child.text.split()).strip() or None

        from_km = to_km = length_km = None
        if name:
            m = _CH_RE.search(name)
            if m:
                from_km = round(float(m.group(1)), 3)
                to_km = round(float(m.group(2)), 3)
                length_km = round(abs(to_km - from_km), 3)

        outer: list[list[float]] | None = None
        for geom in pm.iter():
            if _localname(geom.tag) != "Polygon":
                continue
            for child in geom.iter():
                if _localname(child.tag) == "coordinates" and child.text:
                    outer = _parse_ring(child.text)
                    break
            if outer:
                break

        if not outer or len(outer) < 3:
            continue

        idx += 1
        if from_km is not None:
            from_vals.append(from_km)
        if to_km is not None:
            to_vals.append(to_km)
        if length_km is not None:
            coverage += length_km

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"REW-{idx:02d}",
                    "index": idx,
                    "name": name or f"RE Wall {idx}",
                    "from_km": from_km,
                    "to_km": to_km,
                    "length_km": length_km,
                    "color": RE_WALL_COLOR,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [outer],
                },
            }
        )

    return {
        "title": "RE Walls",
        "description": "Reinforced-earth retaining wall footprints along the corridor",
        "source_file": os.path.basename(path),
        "count": len(features),
        "color": RE_WALL_COLOR,
        "from_km": min(from_vals) if from_vals else None,
        "to_km": max(to_vals) if to_vals else None,
        "total_coverage_km": round(coverage, 3),
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    if not os.path.isfile(SRC):
        raise SystemExit(f"KML not found: {SRC}")
    payload = parse_kml(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT}")
    print(
        f"RE walls: {payload['count']} · coverage {payload['total_coverage_km']} km · "
        f"Ch {payload['from_km']}–{payload['to_km']} km"
    )


if __name__ == "__main__":
    main()
