"""Parse centerline / LHS / RHS elevation KMLs into Elevation_data_100m_distance.json."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

DOWNLOADS = Path(r"C:\Users\Kunal.Desale\Downloads")
SOURCES = [
    ("centerline", DOWNLOADS / "Center_Line_Elevation_Points.kml"),
    ("lhs", DOWNLOADS / "30m_LHS_Elevation_Points.kml"),
    ("rhs", DOWNLOADS / "30m_RHS_Elevation_Points.kml"),
]
OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "Elevation_data_100m_distance.json"

SIMPLE_RE = re.compile(
    r'<SimpleData\s+name="([^"]+)">([^<]*)</SimpleData>',
    re.I,
)
COORD_RE = re.compile(
    r"<coordinates>\s*([-\d.]+)\s*,\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*</coordinates>",
    re.I,
)
PLACEMARK_RE = re.compile(r"<Placemark>([\s\S]*?)</Placemark>", re.I)


def parse_kml(path: Path, branch: str) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows: list[dict] = []

    for block in PLACEMARK_RE.findall(text):
        fields = {k: v.strip() for k, v in SIMPLE_RE.findall(block)}
        # Prefer ExtendedData; fall back to <coordinates> lon,lat,alt
        lat = fields.get("latitude")
        lon = fields.get("longitude")
        elev = fields.get("altitude (") or fields.get("altitude") or fields.get("elevation")
        chainage = fields.get("chainage")

        if lat is None or lon is None:
            m = COORD_RE.search(block)
            if not m:
                continue
            lon, lat, elev_c = m.group(1), m.group(2), m.group(3)
            if elev is None:
                elev = elev_c

        if lat is None or lon is None or elev is None or chainage is None:
            continue

        ch = round(float(chainage), 3)
        rows.append(
            {
                "chainage": ch,
                "elevation": round(float(elev), 2),
                "latitude": round(float(lat), 8),
                "longitude": round(float(lon), 8),
                "distance": round(ch * 1000, 1),
                "trees": 0,
                "branch": branch,
            }
        )

    rows.sort(key=lambda p: p["chainage"])
    return rows


def main() -> None:
    all_rows: list[dict] = []
    for branch, path in SOURCES:
        if not path.exists():
            raise SystemExit(f"Missing KML: {path}")
        part = parse_kml(path, branch)
        print(f"{branch}: {len(part)} points from {path.name}")
        if part:
            print(
                f"  chainage {part[0]['chainage']}–{part[-1]['chainage']} km  "
                f"elev {min(p['elevation'] for p in part):.1f}–{max(p['elevation'] for p in part):.1f} m"
            )
        all_rows.extend(part)

    all_rows.sort(key=lambda p: (p["chainage"], p["branch"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(all_rows, f, separators=(",", ":"))

    by_branch = {
        b: sum(1 for p in all_rows if p["branch"] == b) for b, _ in SOURCES
    }
    print(f"wrote {OUT}")
    print(f"total: {len(all_rows)}  per branch: {by_branch}")


if __name__ == "__main__":
    main()
