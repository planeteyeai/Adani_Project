"""Parse Digha–Koilwar village polygons from KML into GeoJSON for the frontend."""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET

SRC = r"C:\Users\Kunal.Desale\Downloads\9f8398760c0d406d95779a1cd4ef9664 (1).kml"
OUT = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "villages.json"
)

_NS_RE = re.compile(r"\{.*?\}")
_WS_RE = re.compile(r"\s+")
_TD_RE = re.compile(
    r"<tr>\s*<td>\s*([^<]+?)\s*</td>\s*<td>\s*([^<]*?)\s*</td>\s*</tr>",
    re.IGNORECASE | re.DOTALL,
)


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


def _parse_description(html: str | None) -> dict[str, str]:
    if not html:
        return {}
    out: dict[str, str] = {}
    for m in _TD_RE.finditer(html):
        key = m.group(1).strip()
        val = m.group(2).strip()
        if key:
            out[key] = val
    return out


def _first_text(node: ET.Element, local: str) -> str | None:
    for child in node:
        if _localname(child.tag) == local and child.text:
            return child.text.strip() or None
    return None


def _polygon_ring(pm: ET.Element) -> list[list[float]] | None:
    for geom in pm.iter():
        if _localname(geom.tag) != "Polygon":
            continue
        for child in geom.iter():
            if _localname(child.tag) == "coordinates" and child.text:
                ring = _parse_ring(child.text)
                if len(ring) >= 3:
                    return ring
    return None


def _point_coord(pm: ET.Element) -> list[float] | None:
    for geom in pm.iter():
        if _localname(geom.tag) != "Point":
            continue
        for child in geom.iter():
            if _localname(child.tag) == "coordinates" and child.text:
                ring = _parse_ring(child.text)
                if ring:
                    return ring[0]
    return None


def parse_kml(path: str) -> dict:
    # KML from Earth Pro may include undeclared ns1:link tags — strip them.
    with open(path, encoding="utf-8", errors="ignore") as f:
        raw = f.read()
    raw = re.sub(r"</?ns\d+:[^>]*>", "", raw)
    root = ET.fromstring(raw)
    features: list[dict] = []
    idx = 0

    def handle_folder(folder: ET.Element, folder_name: str) -> None:
        nonlocal idx
        ring: list[list[float]] | None = None
        label: list[float] | None = None
        attrs: dict[str, str] = {}

        for child in folder:
            if _localname(child.tag) != "Placemark":
                continue
            poly = _polygon_ring(child)
            if poly:
                ring = poly
                desc = None
                for el in child:
                    if _localname(el.tag) == "description" and el.text:
                        desc = el.text
                        break
                attrs = _parse_description(desc)
                continue
            pt = _point_coord(child)
            if pt:
                label = pt

        if not ring:
            return

        idx += 1
        name = attrs.get("NAME") or folder_name or f"Village {idx}"
        props: dict = {
            "id": f"VIL-{idx:03d}",
            "index": idx,
            "name": name,
            "folder": folder_name,
            "type": attrs.get("TYPE") or "Village",
            "sub_district": attrs.get("SUB_DIST") or None,
            "district": attrs.get("DISTRICT") or None,
            "state": attrs.get("STATE") or None,
            "census_2001": attrs.get("CEN_2001") or None,
        }
        if label and len(label) >= 2:
            props["label_lon"] = label[0]
            props["label_lat"] = label[1]

        features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )

    def walk(node: ET.Element) -> None:
        tag = _localname(node.tag)
        if tag == "Folder":
            folder_name = _first_text(node, "name") or "Village"
            # Leaf village folders contain Placemarks directly
            has_pm = any(_localname(c.tag) == "Placemark" for c in node)
            if has_pm:
                handle_folder(node, folder_name)
            for child in node:
                walk(child)
            return
        for child in node:
            walk(child)

    walk(root)
    return {
        "title": "Villages",
        "description": "Village boundaries along the Digha–Koilwar corridor",
        "count": len(features),
        "type": "FeatureCollection",
        "features": features,
    }


def main() -> None:
    data = parse_kml(SRC)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Wrote {data['count']} villages -> {OUT}")


if __name__ == "__main__":
    main()
