const EARTH_RADIUS_MILES = 3958.8;

export type LatLng = { lat: number; lng: number };

/** Straight-line distance. This is not a driving distance. */
export function straightLineMiles(a: LatLng, b: LatLng): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatStraightLine(miles: number): string {
  const rounded = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${rounded} mi straight-line`;
}

export function directionsUrl(destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
}

export function multiStopDirectionsUrl(stops: LatLng[]): string | null {
  if (stops.length === 0) return null;
  const last = stops[stops.length - 1];
  if (!last) return null;
  const waypoints = stops
    .slice(0, -1)
    .map((stop) => `${stop.lat},${stop.lng}`)
    .join("|");
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${last.lat},${last.lng}`);
  if (waypoints) url.searchParams.set("waypoints", waypoints);
  return url.toString();
}
