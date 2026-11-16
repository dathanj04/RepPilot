export type MapPoint = { lat: number; lng: number };

/** Ray casting with boundary inclusion, using actual account coordinates rather than cluster centers. */
export function insideLasso(point: MapPoint, polygon: MapPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    const cross = (point.lng - a.lng) * (b.lat - a.lat) - (point.lat - a.lat) * (b.lng - a.lng);
    if (Math.abs(cross) < 1e-10 && point.lat >= Math.min(a.lat, b.lat) && point.lat <= Math.max(a.lat, b.lat) && point.lng >= Math.min(a.lng, b.lng) && point.lng <= Math.max(a.lng, b.lng)) return true;
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lng < (b.lng - a.lng) * (point.lat - a.lat) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

/** TomTom v1 pairs each original sequence position with the input waypoint now occupying it. */
export function optimizedPointOrder(body: unknown, count: number): number[] | null {
  if (count < 2 || count > 13) return null;
  if (count === 2) return [0, 1];
  const entries = (body as { optimizedWaypoints?: { providedIndex: number; optimizedIndex: number }[] } | null)?.optimizedWaypoints;
  const n = count - 2;
  if (!Array.isArray(entries) || entries.length !== n) return null;
  const permutation = (values: number[]) => values.every(v => Number.isInteger(v) && v >= 0 && v < n) && new Set(values).size === n;
  if (!entries.every(e => e && typeof e === 'object') || !permutation(entries.map(e => e.providedIndex)) || !permutation(entries.map(e => e.optimizedIndex))) return null;
  return [0, ...[...entries].sort((a,b) => a.providedIndex - b.providedIndex).map(e => e.optimizedIndex + 1), count - 1];
}
