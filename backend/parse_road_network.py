"""Parse OSM road network (1000 m buffer) KML into GeoJSON for the map."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\RoadNetwork(1000mBuffer).kml"
OUT = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "road_network.json"
)

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")

# Prefer these SimpleData keys for the display name.
_NAME_KEYS = ("name", "name_en", "ref", "ref_old")


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _parse_line(text: str) -> list[list[float]]:
    pts: list[list[float]] = []
    for token in _WS_RE.split(text.strip()):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = round(float(parts[0]), 6)
            lat = round(float(parts[1]), 6)
        except ValueError:
            continue
        if pts and pts[-1][0] == lon and pts[-1][1] == lat:
            continue
        pts.append([lon, lat])
    return pts


def _simple_data(pm: ET.Element) -> dict[str, str]:
    props: dict[str, str] = {}
    for d in pm.iter():
        if _localname(d.tag) != "SimpleData":
            continue
        key = d.get("name")
        if key and d.text:
            props[key] = d.text.strip()
    for child in pm:
        if _localname(child.tag) == "name" and child.text:
            props.setdefault("name", child.text.strip())
    return props


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    idx = 0
    by_highway: dict[str, int] = {}

    for pm in root.iter():
        if _localname(pm.tag) != "Placemark":
            continue
        props = _simple_data(pm)
        highway = props.get("highway") or "unknown"
        name = None
        for key in _NAME_KEYS:
            if props.get(key):
                name = props[key]
                break

        for geom in pm.iter():
            if _localname(geom.tag) != "LineString":
                continue
            for child in geom:
                if _localname(child.tag) != "coordinates" or not child.text:
                    continue
                ring = _parse_line(child.text)
                if len(ring) < 2:
                    continue
                idx += 1
                by_highway[highway] = by_highway.get(highway, 0) + 1
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "id": f"RN-{idx:04d}",
                            "index": idx,
                            "name": name,
                            "highway": highway,
                            "surface": props.get("surface"),
                            "lanes": props.get("lanes"),
                            "ref": props.get("ref") or props.get("ref_old"),
                            "osm_id": props.get("osm_id"),
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": ring,
                        },
                    }
                )

    return {
        "title": "Road Network",
        "description": "OSM road network within 1000 m of the project corridor",
        "count": len(features),
        "highway_counts": [
            {"highway": k, "count": v}
            for k, v in sorted(by_highway.items(), key=lambda x: -x[1])
        ],
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    data = parse_kml(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Wrote {data['count']} road segments -> {OUT}")
    for row in data["highway_counts"][:12]:
        print(f"  {row['highway']}: {row['count']}")


if __name__ == "__main__":
    main()
