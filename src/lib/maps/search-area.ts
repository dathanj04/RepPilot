import type { PlaceCandidate } from "./provider";
export type SearchArea = { north: number; south: number; east: number; west: number };
export function validSearchArea(area: SearchArea | null | undefined): area is SearchArea {
  return Boolean(area && Object.values(area).every(Number.isFinite) && area.north <= 90 && area.south >= -90 && area.north > area.south && area.east <= 180 && area.west >= -180 && area.east > area.west);
}
export function placesInArea(places: PlaceCandidate[], area?: SearchArea | null) {
  if (!validSearchArea(area)) return places;
  return places.filter(p => p.lat >= area.south && p.lat <= area.north && p.lng >= area.west && p.lng <= area.east);
}
