"""Parse settlement building polygons from KML into GeoJSON.

Segregates Structures within Acquisition Boundary by placemark name codes
from the settle.kml (B / TEMPLE / SCHOOL / brick kiln / …).
"""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = os.path.dirname(__file__)
SRC = os.path.join(ROOT, "data", "settle_structures.kml")
# Fallback to the Downloads path if data copy is missing
SRC_FALLBACK = r"C:\Users\Kunal.Desale\Downloads\f5b45d8ecafe45ceb8c0e670500b62cc.kml"
OUT = os.path.join(ROOT, "..", "frontend", "public", "affected_houses.json")

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")

# use_class id → display label + colour (kept in sync with frontend)
USE_CLASSES: dict[str, dict[str, str]] = {
    "house": {"label": "House", "color": "#ef4444"},
    "educational": {"label": "Educational", "color": "#3b82f6"},
    "temple": {"label": "Temple", "color": "#a855f7"},
    "mosque": {"label": "Mosque", "color": "#14b8a6"},
    "brick_kiln": {"label": "Brick kiln", "color": "#ea580c"},
    "other": {"label": "Other", "color": "#64748b"},
}


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
            lon = round(float(parts[0]), 6)
            lat = round(float(parts[1]), 6)
        except ValueError:
            continue
        if ring and ring[-1][0] == lon and ring[-1][1] == lat:
            continue
        ring.append([lon, lat])
    return ring


def _ext_data_id(pm: ET.Element) -> str | None:
    for el in pm.iter():
        tag = _localname(el.tag)
        if tag == "SimpleData" and (el.attrib.get("name") or "").lower() == "id":
            if el.text and el.text.strip():
                return el.text.strip()
        if tag == "Data" and (el.attrib.get("name") or "").lower() == "id":
            for child in el:
                if _localname(child.tag) == "value" and child.text and child.text.strip():
                    return child.text.strip()
    return None


def classify_name(raw: str | None) -> tuple[str, str]:
    """Map settle.kml placemark name → (use_class_id, display_label)."""
    code = (raw or "").strip()
    key = re.sub(r"\s+", " ", code).upper()

    if key in {"B", "B1", "B2", "B3", "B4"} or re.fullmatch(r"B\d*", key):
        return "house", USE_CLASSES["house"]["label"]
    if key in {"S", "S1", "S2", "SHOP"}:
        return "house", USE_CLASSES["house"]["label"]
    if key in {"SCHOOL", "SCH"} or "SCHOOL" in key:
        return "educational", USE_CLASSES["educational"]["label"]
    if key in {"TEMPLE", "MANDIR"} or "TEMPLE" in key:
        return "temple", USE_CLASSES["temple"]["label"]
    if key in {"M", "MOSQUE", "MASJID"}:
        return "mosque", USE_CLASSES["mosque"]["label"]
    if "BRICK" in key and "KILN" in key:
        return "brick_kiln", USE_CLASSES["brick_kiln"]["label"]
    if key in {"BV", "VACANT"}:
        return "house", USE_CLASSES["house"]["label"]
    if not code:
        return "house", USE_CLASSES["house"]["label"]
    return "other", code or USE_CLASSES["other"]["label"]


def parse_kml(path: str) -> dict:
    root = ET.parse(path).getroot()
    features: list[dict] = []
    folder_stack: list[str] = []
    idx = 0
    class_counts: Counter[str] = Counter()

    def handle_placemark(pm: ET.Element) -> None:
        nonlocal idx
        name = None
        for child in pm:
            if _localname(child.tag) == "name" and child.text:
                name = child.text.strip() or None

        folder = " / ".join(folder_stack) if folder_stack else None
        source_id = _ext_data_id(pm)
        use_class, use_label = classify_name(name)
        color = USE_CLASSES[use_class]["color"]

        for geom in pm.iter():
            if _localname(geom.tag) != "Polygon":
                continue
            for child in geom.iter():
                if _localname(child.tag) == "coordinates" and child.text:
                    ring = _parse_ring(child.text)
                    if len(ring) < 3:
                        continue
                    idx += 1
                    class_counts[use_class] += 1
                    features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "id": f"BS-{idx:04d}",
                                "index": idx,
                                "name": name or use_label,
                                "code": (name or "").strip() or None,
                                "use_class": use_class,
                                "use_label": use_label,
                                "color": color,
                                "folder": folder,
                                "source_id": source_id,
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
        elif tag in ("Document", "kml"):
            for child in node:
                walk(child)
        elif tag == "Placemark":
            handle_placemark(node)

    walk(root)

    class_summary = [
        {
            "id": cid,
            "label": meta["label"],
            "color": meta["color"],
            "count": class_counts.get(cid, 0),
        }
        for cid, meta in USE_CLASSES.items()
        if class_counts.get(cid, 0) > 0
    ]

    return {
        "title": "Structures within Acquisition Boundary",
        "description": (
            "Building footprints inside the land acquisition boundary, "
            "segregated by use from settle.kml placemark codes"
        ),
        "source_file": os.path.basename(path),
        "source_folder": folder_stack[0] if folder_stack else "settle",
        "count": len(features),
        "classes": class_summary,
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    path = SRC if os.path.isfile(SRC) else SRC_FALLBACK
    if not os.path.isfile(path):
        raise SystemExit(f"KML not found: {SRC} or {SRC_FALLBACK}")
    payload = parse_kml(path)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"wrote {OUT}")
    print(f"buildings: {payload['count']}")
    print(f"source: {payload.get('source_file')}")
    for row in payload["classes"]:
        print(f"  {row['label']}: {row['count']}")


if __name__ == "__main__":
    main()
