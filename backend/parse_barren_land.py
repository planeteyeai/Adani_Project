"""Parse barren-land polygons from KML into GeoJSON (frontend/public/barren_land.json).

Source: Barren_Land_Digha_Koilwar_5km_Zone KML — 935 Placemarks, each a Polygon
with ExtendedData holding area_sqm / area_acre / area_ha.
"""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\d5a05b436c534650be3b4b2d49b94b95.kml"
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "barren_land.json")

# Earthy tan so it reads as barren ground and stays distinct from the orange
# flood / road-formation overlays.
BARREN_COLOR = "#c2853b"

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _f(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


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


def _extended_data(pm: ET.Element) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for data in pm.iter():
        if _localname(data.tag) != "Data":
            continue
        key = data.get("name")
        if not key:
            continue
        for child in data:
            if _localname(child.tag) == "value" and child.text is not None:
                out[key] = _f(child.text.strip())
    return out


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    idx = 0
    total_sqm = 0.0

    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue

        name = None
        for child in pm:
            if _localname(child.tag) == "name" and child.text:
                name = child.text.strip() or None

        ext = _extended_data(pm)
        area_sqm = ext.get("area_sqm")

        outer: list[list[float]] | None = None
        for geom in pm.iter():
            if _localname(geom.tag) != "Polygon":
                continue
            for child in geom:
                if _localname(child.tag) == "outerBoundaryIs":
                    for ring_el in child.iter():
                        if _localname(ring_el.tag) == "coordinates" and ring_el.text:
                            outer = _parse_ring(ring_el.text)
                            break
                    break
            if outer is None:
                for child in geom.iter():
                    if _localname(child.tag) == "coordinates" and child.text:
                        outer = _parse_ring(child.text)
                        break
            if outer:
                break

        if not outer or len(outer) < 3:
            continue

        idx += 1
        if area_sqm is not None:
            total_sqm += area_sqm

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": name or f"Barren-{idx:03d}",
                    "index": idx,
                    "class": "Barren Land",
                    "name": name or f"Barren-{idx:03d}",
                    "color": BARREN_COLOR,
                    "area_sqm": area_sqm,
                    "area_acre": ext.get("area_acre"),
                    "area_ha": ext.get("area_ha"),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [outer],
                },
            }
        )

    return {
        "title": "Barren Land",
        "description": "Barren-land parcels within the Digha–Koilwar 5 km zone",
        "source_file": os.path.basename(path),
        "count": len(features),
        "color": BARREN_COLOR,
        "total_area_m2": round(total_sqm, 2),
        "total_area_ha": round(total_sqm / 10_000, 3),
        "total_area_acre": round(total_sqm / 4046.8564224, 3),
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    data = parse_kml(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(
        f"Wrote {data['count']} barren-land polygons "
        f"({data['total_area_ha']} ha) -> {OUT}"
    )


if __name__ == "__main__":
    main()
