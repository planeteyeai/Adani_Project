import type { ElevationPoint } from "../components/ElevationGraphModal";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chainageLabel(km: number): string {
  const whole = Math.floor(km);
  const frac = Math.round((km - whole) * 1000);
  return `${whole}+${String(frac).padStart(3, "0")}`;
}

type GeoPoint = ElevationPoint & { latitude: number; longitude: number };

/** Build KML with ground-elevation placemarks and a 3D profile line. */
export function elevationPointsToKml(
  points: ElevationPoint[],
  projectName = "GeoVision Ground Elevation"
): string {
  const geoPoints: GeoPoint[] = points
    .map((p) => ({
      ...p,
      chainage: Number(p.chainage),
      elevation: Number(p.elevation),
      latitude: p.latitude,
      longitude: p.longitude,
    }))
    .filter(
      (p): p is GeoPoint =>
        !Number.isNaN(p.chainage) &&
        !Number.isNaN(p.elevation) &&
        p.latitude != null &&
        p.longitude != null &&
        !Number.isNaN(p.latitude) &&
        !Number.isNaN(p.longitude)
    )
    .sort((a, b) => a.chainage - b.chainage || a.longitude - b.longitude);

  const placemarks = geoPoints
    .map((p, i) => {
      const name = chainageLabel(p.chainage);
      const desc = [
        `Chainage: ${p.chainage.toFixed(3)} km`,
        `Ground elevation (SRTM): ${p.elevation.toFixed(1)} m`,
        `Latitude: ${p.latitude.toFixed(6)}`,
        `Longitude: ${p.longitude.toFixed(6)}`,
      ].join("\n");

      return `    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}</description>
      <ExtendedData>
        <Data name="chainage_km"><value>${p.chainage.toFixed(3)}</value></Data>
        <Data name="elevation_m"><value>${p.elevation.toFixed(1)}</value></Data>
      </ExtendedData>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${p.longitude.toFixed(6)},${p.latitude.toFixed(6)},${p.elevation.toFixed(1)}</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("\n");

  const lineCoords = geoPoints
    .map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)},${p.elevation.toFixed(1)}`)
    .join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(projectName)}</name>
    <description>Ground elevation profile from SRTM at chainage marker coordinates (${geoPoints.length} points)</description>
    <Style id="profileLine">
      <LineStyle><color>ff00c9b012</color><width>3</width></LineStyle>
      <PolyStyle><color>7f00c9b012</color></PolyStyle>
    </Style>
    <Folder>
      <name>Elevation points</name>
${placemarks}
    </Folder>
    <Placemark>
      <name>Ground elevation profile</name>
      <styleUrl>#profileLine</styleUrl>
      <LineString>
        <altitudeMode>absolute</altitudeMode>
        <tessellate>1</tessellate>
        <coordinates>${lineCoords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

/** Trigger browser download of elevation data as KML. */
export function downloadElevationKml(
  points: ElevationPoint[],
  filename = "ground_elevation_profile.kml",
  projectName?: string
): void {
  const kml = elevationPointsToKml(points, projectName);
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
