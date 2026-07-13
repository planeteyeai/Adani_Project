# GeoVision — AI Powered Satellite-Based Planning & Infrastructure Intelligence Platform

An enterprise-grade web platform for satellite-based planning and engineering
analysis of large **linear infrastructure** projects — highways, gas pipelines,
railways, transmission lines, canals, solar parks, metro rail and more.

The core idea: bring in a project alignment (KMZ/KML) and explore it across **many
kinds of maps and satellite views**, then generate GIS-driven engineering
intelligence — terrain, earthwork, structures, land use and risk.

> The bundled demo uses the **real Digha–Sherpur–Koilwar 4-Lane Ganga Path**
> alignment (Patna, Bihar, ~35 km design length) parsed from the supplied KMZ —
> 2,077 line features and 1,118 points.

---

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 · Vite · TypeScript · Tailwind CSS · Framer Motion · React-Leaflet · Recharts |
| Backend   | Django 5 · Django REST Framework · django-cors-headers |
| Database  | PostgreSQL (default) with a zero-config SQLite fallback |
| Geo       | Pure-Python KML/KMZ parser (no GDAL/GEOS needed to run) |

### Map & satellite views (the key feature)
Eight keyless base layers, switchable live in the Map Explorer:
Esri **Satellite**, Esri **Satellite Clarity**, **Hybrid** (imagery + labels),
Esri **Terrain**, **Topographic** (OpenTopoMap), **Street** (OSM),
**Light** (Carto Positron) and **Dark Matter** (Carto) — plus analysis overlays
(alignment, chainage/structures, RoW corridor buffer, simulated slope heat),
opacity control, distance measurement and live coordinates.

---

## Project layout

```
Adani/
├─ backend/            Django + DRF API
│  ├─ geovision/       settings, urls, wsgi/asgi
│  ├─ projects/        models, serializers, views, KML parser, analysis
│  ├─ generate_demo.py builds the bundled demo GeoJSON from a KMZ/KML
│  └─ requirements.txt
└─ frontend/           React + Vite app
   ├─ src/pages/       Landing, MapExplorer, Dashboard, Projects
   ├─ src/components/  Navbar, Footer, HeroGlobe, Icon
   ├─ src/lib/         basemaps, api client, metrics, types
   └─ src/data/        demo_project.json (bundled), content
```

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
```

**Option A — PostgreSQL (default, recommended)**

Create a database, then copy `.env.example` to `.env` and set your credentials:

```
DB_NAME=geovision
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
```

```bash
python manage.py migrate
python manage.py runserver 8010
```

**Option B — zero-config SQLite (for a quick demo)**

```bash
set USE_SQLITE=1                 # Windows PowerShell: $env:USE_SQLITE=1
python manage.py migrate
python manage.py runserver 8010
```

The API seeds the Digha–Koilwar demo project automatically on first request.

API: <http://localhost:8010/api/>  ·  Health: `/api/health/`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (e.g. <http://localhost:5173>). The Vite dev server proxies
`/api` to `http://localhost:8010`.

> The frontend also works **without** the backend — it falls back to the bundled
> demo project and computes metrics client-side — so the landing page, map explorer
> and dashboard always render. The backend is required for **uploading** new
> projects and for persistence.

---

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET  | `/api/health/`               | Service + DB status |
| GET  | `/api/projects/`             | List projects (seeds demo) |
| GET  | `/api/projects/{id}/`        | Project detail incl. GeoJSON |
| GET  | `/api/projects/{id}/metrics/`| Derived engineering metrics |
| POST | `/api/projects/upload/`      | Upload KMZ/KML → parsed project |

Upload example:

```bash
curl -F "file=@alignment.kmz" -F "name=NH-XX Bypass" -F "industry=Highways" \
     http://localhost:8010/api/projects/upload/
```

---

## Regenerating the demo from a KMZ/KML

```bash
cd backend
set KML_SRC=C:\path\to\your.kml    # or .kmz
python generate_demo.py
```

This writes `frontend/src/data/demo_project.json` and a backend fixture.

---

## Notes on the engineering metrics

Earthwork, slope bands, structure counts, land-use split and risk scores are
**deterministic heuristics derived from the alignment geometry** so the demo is
fully self-contained. In production these are replaced by real DEM / raster /
remote-sensing analysis (SRTM, Sentinel, Cartosat, LiDAR) — the API response
shapes are already designed for that swap. Swap the Leaflet basemaps for keyed
Mapbox / Google / Bing / Cesium layers the same way.
```
