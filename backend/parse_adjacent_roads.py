"""Parse adjacent-road CSV points into JSON for the map overlay."""
from __future__ import annotations

import csv
import json
from pathlib import Path

SRC = Path(r"C:\Users\Kunal.Desale\Downloads\750eff2c35cd48588ac6cd8a10e62a9d.csv")
OUT = Path(r"C:\Users\Kunal.Desale\Desktop\Adani\frontend\public\adjacent_roads.json")


def main() -> None:
    points: list[dict] = []
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            try:
                lat = float(row.get("Latitude") or row.get("latitude") or "")
                lon = float(row.get("Longitude") or row.get("longitude") or "")
            except (TypeError, ValueError):
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            asset = (row.get("Asset_Type") or row.get("asset_type") or "Adjacent Road").strip()
            points.append(
                {
                    "id": f"AR-{i:02d}",
                    "index": i,
                    "name": asset or f"Adjacent Road {i}",
                    "asset_type": asset or "Adjacent Road",
                    "lat": round(lat, 8),
                    "lon": round(lon, 8),
                }
            )

    payload = {
        "title": "Adjacent Roads",
        "description": "Adjacent road access points along the corridor",
        "source_file": SRC.name,
        "count": len(points),
        "points": points,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(points)} adjacent roads -> {OUT}")


if __name__ == "__main__":
    main()
