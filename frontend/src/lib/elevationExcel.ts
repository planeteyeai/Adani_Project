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

function numberCell(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "<Cell><Data ss:Type=\"String\"></Data></Cell>";
  return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
}

function stringCell(value: string, styleId?: string): string {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

/** Build a SpreadsheetML 2003 workbook (opens natively in Excel). */
export function elevationPointsToExcel(
  points: ElevationPoint[],
  projectName = "GeoVision Ground Elevation"
): string {
  const rows = points
    .map((p) => ({
      chainage: Number(p.chainage),
      elevation: Number(p.elevation),
      latitude: p.latitude,
      longitude: p.longitude,
      distance: p.distance,
    }))
    .filter((p) => !Number.isNaN(p.chainage) && !Number.isNaN(p.elevation))
    .sort((a, b) => a.chainage - b.chainage || (a.longitude ?? 0) - (b.longitude ?? 0));

  const elevations = rows.map((r) => r.elevation);
  const minE = elevations.length ? Math.min(...elevations) : 0;
  const maxE = elevations.length ? Math.max(...elevations) : 0;
  const avgE = elevations.length ? elevations.reduce((a, b) => a + b, 0) / elevations.length : 0;

  const header =
    "<Row ss:StyleID=\"sHeader\">" +
    ["Chainage", "Chainage (km)", "Distance (m)", "Ground Elevation (m)", "Latitude", "Longitude"]
      .map((h) => stringCell(h, "sHeader"))
      .join("") +
    "</Row>";

  const bodyRows = rows
    .map(
      (r) =>
        "<Row>" +
        stringCell(chainageLabel(r.chainage)) +
        numberCell(r.chainage) +
        numberCell(r.distance ?? r.chainage * 1000) +
        numberCell(r.elevation) +
        numberCell(r.latitude) +
        numberCell(r.longitude) +
        "</Row>"
    )
    .join("");

  const summaryRows =
    "<Row></Row>" +
    `<Row>${stringCell("Summary", "sHeader")}</Row>` +
    `<Row>${stringCell("Points")}${numberCell(rows.length)}</Row>` +
    `<Row>${stringCell("Min elevation (m)")}${numberCell(Math.round(minE * 100) / 100)}</Row>` +
    `<Row>${stringCell("Max elevation (m)")}${numberCell(Math.round(maxE * 100) / 100)}</Row>` +
    `<Row>${stringCell("Avg elevation (m)")}${numberCell(Math.round(avgE * 100) / 100)}</Row>` +
    `<Row>${stringCell("Source")}${stringCell("SRTM DEM (Open-Elevation)")}</Row>`;

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F766E" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Ground Elevation">
  <Table>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   ${header}
   ${bodyRows}
   ${summaryRows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="About">
  <Table>
   <Row>${stringCell(projectName, "sHeader")}</Row>
   <Row>${stringCell("Ground elevation profile at chainage marker coordinates")}</Row>
  </Table>
 </Worksheet>
</Workbook>`;
}

/** Trigger browser download of elevation data as an Excel workbook. */
export function downloadElevationExcel(
  points: ElevationPoint[],
  filename = "ground_elevation_profile.xls",
  projectName?: string
): void {
  const xml = elevationPointsToExcel(points, projectName);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
