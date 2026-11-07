import "server-only";
import { googleMapsServerKey } from "@/lib/maps-config";
import {
  parseGeocodeResponse,
  parsePlacesResponse,
  parseRoutesResponse,
  safeGoogleMessage,
  type DrivePlan,
  type PlaceCandidate,
} from "@/lib/maps/provider";
import type { LatLng } from "@/lib/domain/distance";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type MapsCallResult<T> =
  | { status: "ok"; value: T }
  | { status: "not_configured" }
  | { status: "not_found" }
  | { status: "error"; message: string };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string, fetchImpl: FetchLike = fetch): Promise<MapsCallResult<LatLng>> {
  const key = googleMapsServerKey();
  if (!key) return { status: "not_configured" };
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), { method: "GET", cache: "no-store" });
  } catch {
    return { status: "error", message: "Geocoding could not be reached." };
  }
  const body = await readJson(response);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error_message" in body ? String((body as { error_message?: string }).error_message) : "";
    return { status: "error", message: safeGoogleMessage(message || "Geocoding rejected the request.") };
  }
  const parsed = parseGeocodeResponse(body);
  if (parsed.status === "ok") return { status: "ok", value: parsed.location };
  if (parsed.status === "not_found") return { status: "not_found" };
  const message = body && typeof body === "object" && "error_message" in body ? String((body as { error_message?: string }).error_message) : "";
  return { status: "error", message: safeGoogleMessage(message || "Geocoding did not return a usable location.") };
}

export async function searchPlaces(
  input: { query: string; bias: LatLng | null },
  fetchImpl: FetchLike = fetch,
): Promise<MapsCallResult<PlaceCandidate[]>> {
  const key = googleMapsServerKey();
  if (!key) return { status: "not_configured" };
  const body: Record<string, unknown> = {
    textQuery: input.query,
    pageSize: 8,
    languageCode: "en",
    regionCode: "US",
  };
  if (input.bias) {
    body.locationBias = {
      circle: {
        center: { latitude: input.bias.lat, longitude: input.bias.lng },
        radius: 25000,
      },
    };
  }
  let response: Response;
  try {
    response = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.location,places.addressComponents",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "error", message: "Places search could not be reached." };
  }
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String((payload as { error?: { message?: string } }).error?.message) : "";
    return { status: "error", message: safeGoogleMessage(message || "Places search was rejected.") };
  }
  return { status: "ok", value: parsePlacesResponse(payload) };
}

export async function computeDrive(
  points: LatLng[],
  fetchImpl: FetchLike = fetch,
): Promise<MapsCallResult<DrivePlan>> {
  const key = googleMapsServerKey();
  if (!key) return { status: "not_configured" };
  if (points.length < 2) return { status: "error", message: "A drive time needs a start and at least one office." };
  const [origin, ...rest] = points;
  const destination = rest[rest.length - 1];
  const intermediates = rest.slice(0, -1);
  if (!origin || !destination) return { status: "error", message: "A drive time needs a start and at least one office." };
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    intermediates: intermediates.map((point) => ({
      location: { latLng: { latitude: point.lat, longitude: point.lng } },
    })),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    departureTime: new Date().toISOString(),
    units: "IMPERIAL",
  };
  let response: Response;
  try {
    response = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "error", message: "Routes could not be reached." };
  }
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String((payload as { error?: { message?: string } }).error?.message) : "";
    return { status: "error", message: safeGoogleMessage(message || "Routes rejected the request.") };
  }
  const plan = parseRoutesResponse(payload);
  if (!plan) return { status: "error", message: "Routes did not return a drive time. Nothing was estimated in its place." };
  return { status: "ok", value: plan };
}
