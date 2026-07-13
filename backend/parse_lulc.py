"""Parse LULC (Land Use / Land Cover) polygons from KML into GeoJSON."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\2b739cea2b094fdf83a769099632b4cc (1).kml"
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "lulc.json")

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")

# Fallback palette if a style colour is missing (KML AABBGGRR → hex).
CLASS_COLORS = {
    "Water": "#1f78b4",
    "Built-up": "#e31a1c",
    "Bareland": "#d9a441",
    "Agriculture": "#33a02c",
    "Forest": "#0b6623",
}


def _localname(tag: str) -> str:
    return _NS_RE.sub("", tag)


def _kml_color_to_hex(kml: str | None) -> str | None:
    """Convert KML AABBGGRR colour to #RRGGBB."""
    if not kml:
        return None
    s = kml.strip().lower()
    if len(s) == 8:
        bb, gg, rr = s[2:4], s[4:6], s[6:8]
        return f"#{rr}{gg}{bb}"
    if len(s) == 6:
        bb, gg, rr = s[0:2], s[2:4], s[4:6]
        return f"#{rr}{gg}{bb}"
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
            ring.append([float(parts[0]), float(parts[1])])
        except ValueError:
            continue
    return ring


def _poly_color(style_el: ET.Element) -> str | None:
    for child in style_el.iter():
        if _localname(child.tag) != "PolyStyle":
            continue
        for cc in child:
            if _localname(cc.tag) == "color" and cc.text:
                return _kml_color_to_hex(cc.text)
    return None


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    styles: dict[str, str | None] = {}
    for el in root.iter():
        if _localname(el.tag) == "Style" and el.get("id"):
            styles[el.get("id") or ""] = _poly_color(el)

    features: list[dict] = []
    folder_stack: list[str] = []
    idx = 0
    class_counts: dict[str, int] = {}

    def handle_placemark(pm: ET.Element) -> None:
        nonlocal idx
        name = None
        style_url = None
        for child in pm:
            tag = _localname(child.tag)
            if tag == "name" and child.text:
                name = child.text.strip() or None
            elif tag == "styleUrl" and child.text:
                style_url = child.text.strip().lstrip("#")

        klass = name or (folder_stack[-1] if folder_stack else "Unknown")
        color = CLASS_COLORS.get(klass)
        if style_url and styles.get(style_url):
            color = styles[style_url]
        for child in pm:
            if _localname(child.tag) == "Style":
                color = _poly_color(child) or color
        if not color:
            color = CLASS_COLORS.get(klass, "#94a3b8")

        for geom in pm.iter():
            if _localname(geom.tag) != "Polygon":
                continue
            # Prefer outer boundary; fall back to first coordinates ring.
            outer: list[list[float]] | None = None
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
            if not outer or len(outer) < 3:
                continue
            idx += 1
            class_counts[klass] = class_counts.get(klass, 0) + 1
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"LULC-{idx:03d}",
                        "index": idx,
                        "class": klass,
                        "name": klass,
                        "color": color,
                        "folder": " / ".join(folder_stack) if folder_stack else None,
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [outer],
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
        "title": "LULC",
        "description": "Land Use / Land Cover polygons along the project corridor",
        "count": len(features),
        "classes": [
            {"name": name, "color": CLASS_COLORS.get(name, "#94a3b8"), "count": class_counts.get(name, 0)}
            for name in ("Agriculture", "Forest", "Built-up", "Bareland", "Water")
            if class_counts.get(name)
        ],
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    data = parse_kml(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Wrote {data['count']} LULC polygons -> {OUT}")
    for c in data["classes"]:
        print(f"  {c['name']}: {c['count']} ({c['color']})")


if __name__ == "__main__":
    main()
