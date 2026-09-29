"""Parse interchange ramp line geometry from KML into GeoJSON.

Source: Interchanges_ 1.kml — a set of Placemarks, each a (Multi)LineString
tracing an interchange ramp / loop alignment. No names or chainage in the file.
Output: frontend/public/interchanges.json (GeoJSON LineString FeatureCollection)
"""
from __future__ import annotations

import json
import math
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\Interchanges_ 1.kml"
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "interchanges.json")

INTERCHANGE_COLOR = "#eab308"

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _parse_line(text: str) -> list[list[float]]:
    line: list[list[float]] = []
    for token in _WS_RE.split(text.strip()):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            line.append([round(float(parts[0]), 7), round(float(parts[1]), 7)])
        except ValueError:
            continue
    return line


def _haversine_km(a: list[float], b: list[float]) -> float:
    lon1, lat1 = a[0], a[1]
    lon2, lat2 = b[0], b[1]
    r = 6371.0088
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _line_length_km(coords: list[list[float]]) -> float:
    total = 0.0
    for i in range(1, len(coords)):
        total += _haversine_km(coords[i - 1], coords[i])
    return total


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    idx = 0
    total_length = 0.0
    all_lons: list[float] = []
    all_lats: list[float] = []

    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue

        for ls in pm.iter():
            if _localname(ls.tag) != "LineString":
                continue
            coords_text = None
            for child in ls.iter():
                if _localname(child.tag) == "coordinates" and child.text:
                    coords_text = child.text
                    break
            if not coords_text:
                continue
            coords = _parse_line(coords_text)
            if len(coords) < 2:
                continue

            idx += 1
            length_km = round(_line_length_km(coords), 3)
            total_length += length_km
            for lon, lat in coords:
                all_lons.append(lon)
                all_lats.append(lat)

            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"ICR-{idx:02d}",
                        "index": idx,
                        "name": f"Interchange ramp {idx}",
                        "length_km": length_km,
                        "color": INTERCHANGE_COLOR,
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coords,
                    },
                }
            )

    bbox = None
    if all_lons and all_lats:
        bbox = [min(all_lons), min(all_lats), max(all_lons), max(all_lats)]

    return {
        "title": "Interchanges",
        "description": "Interchange ramp & loop alignments",
        "source_file": os.path.basename(path),
        "count": len(features),
        "color": INTERCHANGE_COLOR,
        "total_length_km": round(total_length, 3),
        "bbox": bbox,
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
        f"interchanges: {payload['count']} ramps · "
        f"total {payload['total_length_km']} km"
    )


if __name__ == "__main__":
    main()
