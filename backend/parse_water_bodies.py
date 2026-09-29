"""Parse water bodies + waterways KMLs into GeoJSON for the frontend."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

WATER_BODIES_SRC = r"C:\Users\Kunal.Desale\Downloads\3f93dc9b031b4125841e26733b3c90ed.kml"
WATERWAYS_SRC = r"C:\Users\Kunal.Desale\Downloads\b5a1571e26084819bea8aa2bd45db81e.kml"

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
WATER_BODIES_OUT = os.path.join(PUBLIC, "water_bodies.json")
WATERWAYS_OUT = os.path.join(PUBLIC, "waterways.json")

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


def parse_kml(
    path: str,
    *,
    title: str,
    description: str,
    id_prefix: str,
    default_name: str,
) -> dict:
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
        pm_id = pm.attrib.get("id")

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
                                "id": f"{id_prefix}-{idx:03d}",
                                "index": idx,
                                "name": name or f"{default_name} {idx}",
                                "folder": folder,
                                "source_id": pm_id,
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
        "title": title,
        "description": description,
        "source_file": os.path.basename(path),
        "source_folder": None,
        "count": len(features),
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    os.makedirs(PUBLIC, exist_ok=True)

    if not os.path.isfile(WATER_BODIES_SRC):
        raise SystemExit(f"Water bodies KML not found: {WATER_BODIES_SRC}")
    if not os.path.isfile(WATERWAYS_SRC):
        raise SystemExit(f"Waterways KML not found: {WATERWAYS_SRC}")

    bodies = parse_kml(
        WATER_BODIES_SRC,
        title="Water Bodies",
        description="Ponds, lakes and water polygons along the corridor",
        id_prefix="WB",
        default_name="Water body",
    )
    ways = parse_kml(
        WATERWAYS_SRC,
        title="Waterways",
        description="Waterway / canal polygons along the project corridor",
        id_prefix="WW",
        default_name="Waterway",
    )

    with open(WATER_BODIES_OUT, "w", encoding="utf-8") as f:
        json.dump(bodies, f, separators=(",", ":"))
    with open(WATERWAYS_OUT, "w", encoding="utf-8") as f:
        json.dump(ways, f, separators=(",", ":"))

    print(f"Wrote {bodies['count']} water bodies -> {WATER_BODIES_OUT}")
    print(f"Wrote {ways['count']} waterways -> {WATERWAYS_OUT}")


if __name__ == "__main__":
    main()
