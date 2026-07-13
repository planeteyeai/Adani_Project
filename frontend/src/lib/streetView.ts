/** Google Street View helpers (no API key required). */

export function streetViewEmbedUrl(lat: number, lon: number): string {
  return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,0,0,0,0&hl=en&ie=UTF8&output=svembed`;
}

export function streetViewMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

/** Blue coverage overlay — roads where Street View imagery exists. */
export const STREET_VIEW_COVERAGE = {
  url: "https://{s}.google.com/vt?lyrs=svv&x={x}&y={y}&z={z}&style=40",
  subdomains: ["mt0", "mt1", "mt2", "mt3"] as string[],
  maxZoom: 20,
  opacity: 0.85,
};
