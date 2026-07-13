"""Parse water-body polygons from KML into GeoJSON for the frontend."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\3f93dc9b031b4125841e26733b3c90ed.kml"
OUT = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "water_bodies.json"
)

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")


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
            ring.append([float(parts[0]), float(parts[1])])
        except ValueError:
            continue
    return ring


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    folder_stack: list[str] = []
    idx = 0

    def handle_placemark(pm: ET.Element) -> None:
        nonlocal idx
        name = None
        for child in pm:
            if _localname(child.tag) == "name" and child.text:
                name = child.text.strip() or None

        folder = " / ".join(folder_stack) if folder_stack else None
        for geom in pm.iter():
            if _localname(geom.tag) != "Polygon":
                continue
            for child in geom.iter():
                if _localname(child.tag) == "coordinates" and child.text:
                    ring = _parse_ring(child.text)
                    if len(ring) < 3:
                        continue
                    idx += 1
                    features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "id": f"WB-{idx:03d}",
                                "index": idx,
                                "name": name or f"Water body {idx}",
                                "folder": folder,
                            },
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [ring],
                            },
                        }
                    )

    def walk(node: ET.Element) -> None:
        tag = _localname(node.tag)
        if tag == "Folder":
            folder_name = None
            for child in node:
                if _localname(child.tag) == "name" and child.text:
                    folder_name = child.text.strip()
                    break
            if folder_name:
                folder_stack.append(folder_name)
            for child in node:
                walk(child)
            if folder_name:
                folder_stack.pop()
            return
        if tag == "Placemark":
            handle_placemark(node)
            return
        for child in node:
            walk(child)

    walk(root)
    return {
        "title": "Water Bodies",
        "description": "Water body polygons along the project corridor",
        "count": len(features),
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    data = parse_kml(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Wrote {data['count']} water bodies -> {OUT}")


if __name__ == "__main__":
    main()
