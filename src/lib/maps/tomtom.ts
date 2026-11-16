import "server-only";
import { tomtomMapsKey } from "../maps-config";
import type { MapsCallResult } from "./google";
import type { DrivePlan, PlaceCandidate } from "./provider";
import type { LatLng } from "../domain/distance";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type Result = { type?: string; title?: string; position?: { coordinates?: number[] }; address?: { houseNumber?: string; street?: string; municipality?: string; countrySubdivisionCodeIso?: string; postalCode?: string; countryCodeIso2?: string } };
function point(result: Result): LatLng | null {
  const [lng, lat] = result.position?.coordinates ?? [];
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
export function parseTomtomPlaces(body: unknown): PlaceCandidate[] {
  const results = (body as { results?: Result[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap(result => {
    if (!result || result.type !== "poi") return [];
    const p = point(result), a = result.address;
    if (!p || !a || a.countryCodeIso2 !== "US" || !result.title || !a.houseNumber || !a.street || !a.municipality || !a.postalCode || !a.countrySubdivisionCodeIso) return [];
    const state = a.countrySubdivisionCodeIso.replace(/^US-/, "");
    if (!/^[A-Z]{2}$/.test(state)) return [];
    return [{ name: result.title, street: `${a.houseNumber} ${a.street}`, city: a.municipality, state, zip: a.postalCode, ...p }];
  }).slice(0, 8);
}
type Summary = { lengthInMeters?: number; travelTimeInSeconds?: number; trafficDelayInSeconds?: number };
export function parseTomtomDrive(body: unknown): DrivePlan | null {
  const route = (body as { routes?: { summary?: Summary; legs?: { summary?: Summary }[] }[] } | null)?.routes?.[0];
  const valid = (s?: Summary) => s && typeof s.lengthInMeters === "number" && Number.isFinite(s.lengthInMeters) && s.lengthInMeters >= 0 && typeof s.travelTimeInSeconds === "number" && Number.isFinite(s.travelTimeInSeconds) && s.travelTimeInSeconds >= 0;
  if (!route || !valid(route.summary) || !Array.isArray(route.legs) || !route.legs.length || !route.legs.every(l => valid(l.summary))) return null;
  return { source: "tomtom_routes", distanceMeters: route.summary!.lengthInMeters!, durationSeconds: route.summary!.travelTimeInSeconds!, trafficApplied: (route.summary!.trafficDelayInSeconds ?? 0) > 0, legs: route.legs.map(l => ({ distanceMeters: l.summary!.lengthInMeters!, durationSeconds: l.summary!.travelTimeInSeconds! })) };
}
async function call(path: string, version: string, fetchImpl: FetchLike, body?: object, attributes?: string): Promise<MapsCallResult<unknown>> {
  const key = tomtomMapsKey();
  if (!key) return { status: "not_configured" };
  try {
    const response = await fetchImpl(`https://api.tomtom.com/${path}`, { method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(12000), headers: {
      "TomTom-Api-Key": key, "TomTom-Api-Version": version,
      // Fixed application origin; never forward a user-provided referrer.
      Referer: "https://reppilot.app/", Origin: "https://reppilot.app",
      ...(attributes ? { Attributes: attributes } : {}), ...(body ? { "Content-Type": "application/json" } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) return { status: "error", message: response.status === 429 ? "TomTom's usage limit was reached. Please try again later." : `TomTom rejected the request (${response.status}). Check API access and domain settings.` };
    return { status: "ok", value: await response.json() };
  } catch { return { status: "error", message: "TomTom could not be reached. Please try again." }; }
}
export async function geocodeAddress(address: string, fetchImpl: FetchLike = fetch): Promise<MapsCallResult<LatLng>> {
  const query = new URLSearchParams({ query: address, types: "address", maxResults: "1", countryCodesIso2: "US" });
  const result = await call(`maps/orbis/places/geocode?${query}`, "2", fetchImpl, undefined, "results(type,position)");
  if (result.status !== "ok") return result;
  const first = (result.value as { results?: Result[] })?.results?.[0];
  const location = first?.type === "address" ? point(first) : null;
  return location ? { status: "ok", value: location } : { status: "not_found" };
}
export async function searchPlaces(input: { query: string; bias: LatLng | null }, fetchImpl: FetchLike = fetch): Promise<MapsCallResult<PlaceCandidate[]>> {
  const result = await call("maps/orbis/places/discover", "3", fetchImpl, { query: input.query, maxResults: 8, ...(input.bias ? { origin: { type: "point", coordinates: [input.bias.lng, input.bias.lat] }, preferences: { geometry: { type: "point", coordinates: [input.bias.lng, input.bias.lat] } } } : {}) }, "results(type,title,position,address)");
  return result.status === "ok" ? { status: "ok", value: parseTomtomPlaces(result.value) } : result;
}
export async function computeDrive(points: LatLng[], fetchImpl: FetchLike = fetch): Promise<MapsCallResult<DrivePlan>> {
  if (points.length < 2 || points.length > 50 || points.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) return { status: "error", message: "Choose a start and 1–49 valid stops." };
  const locations = points.map(p => `${p.lat},${p.lng}`).join(":");
  const result = await call(`maps/orbis/routing/calculateRoute/${locations}/json?traffic=live&travelMode=car&routeType=fast`, "2", fetchImpl);
  if (result.status !== "ok") return result;
  const plan = parseTomtomDrive(result.value);
  return plan && plan.legs.length === points.length - 1 ? { status: "ok", value: plan } : { status: "error", message: "TomTom did not return a complete route. No driving time was estimated." };
}
