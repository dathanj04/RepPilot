import { straightLineMiles, type LatLng } from "@/lib/domain/distance";

export type PlaceCandidate = {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
};

export type DriveLeg = {
  distanceMeters: number;
  durationSeconds: number;
};

export type DrivePlan = {
  source: "google_routes";
  distanceMeters: number;
  durationSeconds: number;
  /** True only when Google returned a traffic-aware duration that differs from the no-traffic duration. */
  trafficApplied: boolean;
  legs: DriveLeg[];
};

type Component = {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types?: string[];
};

function componentText(components: Component[], type: string, short = false) {
  const match = components.find((item) => item.types?.includes(type));
  if (!match) return "";
  if (short) return match.shortText || match.short_name || "";
  return match.longText || match.long_name || "";
}

export function addressFromComponents(components: Component[]): Omit<PlaceCandidate, "name" | "lat" | "lng"> | null {
  const street = [componentText(components, "street_number"), componentText(components, "route")].filter(Boolean).join(" ");
  const city =
    componentText(components, "locality") ||
    componentText(components, "postal_town") ||
    componentText(components, "sublocality") ||
    componentText(components, "administrative_area_level_3");
  const state = componentText(components, "administrative_area_level_1", true);
  const zip = componentText(components, "postal_code");
  if (!street || !city || !state || !zip) return null;
  return { street, city, state, zip };
}

function finitePoint(lat: unknown, lng: unknown): LatLng | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function parseGeocodeResponse(body: unknown): { status: "ok"; location: LatLng } | { status: "not_found" } | { status: "error" } {
  if (!body || typeof body !== "object") return { status: "error" };
  const status = "status" in body ? String((body as { status?: string }).status) : "";
  if (status === "ZERO_RESULTS") return { status: "not_found" };
  if (status !== "OK") return { status: "error" };
  const results = (body as { results?: unknown }).results;
  if (!Array.isArray(results)) return { status: "error" };
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const locationType = String((result as { geometry?: { location_type?: string } }).geometry?.location_type ?? "");
    if (locationType !== "ROOFTOP" && locationType !== "RANGE_INTERPOLATED") continue;
    const location = (result as { geometry?: { location?: { lat?: unknown; lng?: unknown } } }).geometry?.location;
    const point = finitePoint(location?.lat, location?.lng);
    if (point) return { status: "ok", location: point };
  }
  return { status: "not_found" };
}

export function parsePlacesResponse(body: unknown): PlaceCandidate[] {
  if (!body || typeof body !== "object") return [];
  const places = (body as { places?: unknown }).places;
  if (!Array.isArray(places)) return [];
  const candidates: PlaceCandidate[] = [];
  for (const place of places) {
    if (!place || typeof place !== "object") continue;
    const name = String((place as { displayName?: { text?: string } }).displayName?.text ?? "").trim();
    const location = (place as { location?: { latitude?: unknown; longitude?: unknown } }).location;
    const point = finitePoint(location?.latitude, location?.longitude);
    const components = (place as { addressComponents?: Component[] }).addressComponents ?? [];
    const address = addressFromComponents(components);
    if (!name || !point || !address) continue;
    candidates.push({ name, ...address, lat: point.lat, lng: point.lng });
  }
  return candidates;
}

function parseDuration(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.slice(0, -1));
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

export function parseRoutesResponse(body: unknown): DrivePlan | null {
  if (!body || typeof body !== "object") return null;
  const route = (body as { routes?: unknown }).routes;
  if (!Array.isArray(route) || !route[0] || typeof route[0] !== "object") return null;
  const first = route[0] as {
    duration?: unknown;
    staticDuration?: unknown;
    distanceMeters?: unknown;
    legs?: unknown;
  };
  const durationSeconds = parseDuration(first.duration);
  const distanceMeters = first.distanceMeters;
  if (durationSeconds == null || typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) return null;
  if (!Array.isArray(first.legs) || first.legs.length === 0) return null;
  const legs: DriveLeg[] = [];
  for (const leg of first.legs) {
    if (!leg || typeof leg !== "object") return null;
    const legDuration = parseDuration((leg as { duration?: unknown }).duration);
    const legDistance = (leg as { distanceMeters?: unknown }).distanceMeters;
    if (legDuration == null || typeof legDistance !== "number" || !Number.isFinite(legDistance)) return null;
    legs.push({ durationSeconds: legDuration, distanceMeters: legDistance });
  }
  const staticDuration = parseDuration(first.staticDuration);
  return {
    source: "google_routes",
    durationSeconds,
    distanceMeters,
    trafficApplied: staticDuration != null && Math.abs(staticDuration - durationSeconds) >= 1,
    legs,
  };
}

export function formatDriveDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min drive time`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min drive time` : `${hours} hr drive time`;
}

export function orderByStraightLine<T extends { id: string; location: LatLng | null }>(origin: LatLng | null, stops: T[]): string[] {
  const located = stops.filter((stop): stop is T & { location: LatLng } => stop.location != null);
  const missing = stops.filter((stop) => stop.location == null).map((stop) => stop.id);
  const remaining = [...located];
  const ordered: string[] = [];
  let cursor = origin;
  if (!cursor) {
    remaining.sort((a, b) => a.id.localeCompare(b.id));
    return [...remaining.map((stop) => stop.id), ...missing];
  }
  while (remaining.length > 0) {
    remaining.sort((a, b) => straightLineMiles(cursor!, a.location) - straightLineMiles(cursor!, b.location) || a.id.localeCompare(b.id));
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next.id);
    cursor = next.location;
  }
  return [...ordered, ...missing];
}

export type TimedStop = {
  name: string;
  location: LatLng | null;
  fixedAt: string | null;
};

/** Warn when two timed stops cannot fit the travel between them. Drive time is used only when Google supplied the leg. */
export function appointmentTravelWarnings(input: {
  stops: TimedStop[];
  legs: DriveLeg[] | null;
  bufferMinutes: number;
}): string[] {
  const warnings: string[] = [];
  for (let index = 0; index < input.stops.length - 1; index += 1) {
    const from = input.stops[index];
    const to = input.stops[index + 1];
    if (!from || !to || !from.fixedAt || !to.fixedAt) continue;
    const gapMinutes = (new Date(to.fixedAt).getTime() - new Date(from.fixedAt).getTime()) / 60_000;
    if (gapMinutes <= 0) {
      warnings.push(`${to.name} is scheduled at or before ${from.name}. Confirmed times stay in the order you set.`);
      continue;
    }
    const leg = input.legs?.[index];
    if (leg) {
      const needed = leg.durationSeconds / 60 + input.bufferMinutes;
      if (needed > gapMinutes) {
        warnings.push(
          `Google drive time from ${from.name} to ${to.name} is ${Math.round(leg.durationSeconds / 60)} minutes, plus a ${input.bufferMinutes}-minute buffer. The appointments are ${Math.round(gapMinutes)} minutes apart.`,
        );
      }
      continue;
    }
    if (from.location && to.location) {
      const miles = straightLineMiles(from.location, to.location);
      const pace = miles / (gapMinutes / 60);
      if (pace > 55) {
        warnings.push(
          `${from.name} to ${to.name} is ${miles.toFixed(1)} miles straight-line with ${Math.round(gapMinutes)} minutes between appointments. This is not drive time. The gap may be too short.`,
        );
      }
    }
  }
  return warnings;
}

export function safeGoogleMessage(message: string) {
  return message.replace(/AIza[\w-]{8,}/g, "[key]").slice(0, 180);
}
