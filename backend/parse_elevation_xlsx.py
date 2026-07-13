"""Parse ground elevation workbook into frontend/public/Elevation_data_100m_distance.json."""
from __future__ import annotations

import json
import os

import openpyxl

SRC = r"C:\Users\Kunal.Desale\Downloads\e8ed9e59247847b3a8f6c1bb51e611ce.xlsx"
OUT = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "Elevation_data_100m_distance.json"
)

# Column offsets (0-based) for each alignment block in Sheet1.
SECTIONS = [
    ("lhs", 1),
    ("centerline", 9),
    ("rhs", 17),
]


def main() -> None:
    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb.active
    rows: list[dict] = []

    for branch, col in SECTIONS:
        for r in ws.iter_rows(min_row=3, values_only=True):
            lat = r[col]
            lon = r[col + 1]
            chainage = r[col + 2]
            elevation = r[col + 3]
            if lat is None or lon is None or chainage is None or elevation is None:
                continue
            ch = round(float(chainage), 3)
            rows.append(
                {
                    "chainage": ch,
                    "elevation": round(float(elevation), 2),
                    "latitude": round(float(lat), 8),
                    "longitude": round(float(lon), 8),
                    "distance": round(ch * 1000, 1),
                    "trees": 0,
                    "branch": branch,
                }
            )

    rows.sort(key=lambda p: (p["chainage"], p["branch"]))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, separators=(",", ":"))

    by_branch = {b: sum(1 for p in rows if p["branch"] == b) for b, _ in SECTIONS}
    elevs = [p["elevation"] for p in rows]
    print(f"wrote {OUT}")
    print(f"total rows: {len(rows)}  per branch: {by_branch}")
    print(f"chainage: {rows[0]['chainage']} – {rows[-1]['chainage']} km")
    print(f"elevation range: {min(elevs):.1f} – {max(elevs):.1f} m")


if __name__ == "__main__":
    main()
