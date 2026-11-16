import "server-only";
import { tomtomMapsKey } from "@/lib/maps-config";
import { optimizationSegments, scheduleRoute, type RoutePlanning, type RoutePoint, type RoadLeg, type RoadResult } from "@/lib/domain/route-planning";

type ProviderRoute = { legs?: { summary?: { lengthInMeters?: number; travelTimeInSeconds?: number }; points?: { latitude: number; longitude: number }[] }[]; summary?: { lengthInMeters?: number; travelTimeInSeconds?: number } };
export function waypointOrder(body: unknown, count: number): number[] {
  if (count === 2) return [0, 1];
  const items = (body as { optimizedWaypoints?: { providedIndex: number; optimizedIndex: number }[] }).optimizedWaypoints;
  const n = count - 2;
  if (!Array.isArray(items) || items.length !== n || !["providedIndex", "optimizedIndex"].every(field => { const values = items.map(v => v[field as keyof typeof v]); return values.every(v => Number.isInteger(v) && v >= 0 && v < n) && new Set(values).size === n; })) throw new Error("The routing service returned an invalid visit order.");
  return [0, ...[...items].sort((a,b) => a.providedIndex - b.providedIndex).map(v => v.optimizedIndex + 1), count - 1];
}
export async function requestRoad(points: RoutePoint[], optimize: boolean, departure: string, fetcher: typeof fetch = fetch) {
  const key = tomtomMapsKey();
  if (!key) throw new Error("TomTom Routing is not configured. Your route is still editable.");
  if (points.length < 2 || points.length > 22) throw new Error("Choose up to 20 stops.");
  const query = new URLSearchParams({ key, traffic: "true", travelMode: "car", routeType: "fastest", routeRepresentation: "polyline", computeBestOrder: String(optimize) });
  if (Date.parse(departure) > Date.now() + 60000) query.set("departAt", departure);
  let response: Response;
  try { response = await fetcher("https://api.tomtom.com/routing/1/calculateRoute/" + points.map(p => p.lat + "," + p.lng).join(":") + "/json?" + query, { cache: "no-store", signal: AbortSignal.timeout(25000), headers: { Referer: "https://reppilot.app/", Origin: "https://reppilot.app" } }); }
  catch { throw new Error("Road routing is temporarily unavailable. Your selected order is unchanged."); }
  if (!response.ok) throw new Error(response.status === 429 ? "Routing usage limit reached. Try again shortly." : "A location could not be routed. Check its address or remove the unreachable stop.");
  const body = await response.json();
  const route: ProviderRoute | undefined = body.routes?.[0];
  if (!route?.legs || route.legs.length !== points.length - 1) throw new Error("The service did not return every driving leg.");
  const legs: RoadLeg[] = route.legs.map(l => {
    const durationSeconds = l.summary?.travelTimeInSeconds, distanceMeters = l.summary?.lengthInMeters;
    if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds < 0 || typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters) || distanceMeters < 0) throw new Error("Driving estimates are incomplete.");
    return { durationSeconds, distanceMeters };
  });
  const geometry: [number, number][] = route.legs.flatMap(l => (l.points ?? []).map(p => [p.latitude, p.longitude] as [number, number]));
  if (!geometry.length || geometry.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) throw new Error("The road geometry is incomplete.");
  return { legs, geometry, order: optimize ? waypointOrder(body, points.length) : points.map((_, i) => i) };
}
export async function calculateRoadPlan(input: RoutePlanning, optimize = false, fetcher: typeof fetch = fetch): Promise<{ plan: RoutePlanning; road: RoadResult }> {
  let plan = { ...input, stops: [...input.stops] };
  if (optimize) {
    for (const segment of optimizationSegments(plan)) {
      const middle = plan.stops.slice(segment.left + 1, segment.right);
      if (middle.length < 2) continue;
      const start = segment.left < 0 ? plan.start : plan.stops[segment.left];
      const endpoint = segment.right < plan.stops.length ? plan.stops[segment.right] : plan.end ?? middle[middle.length - 1];
      const movable = segment.right === plan.stops.length && !plan.end ? middle.slice(0, -1) : middle;
      if (!movable.length) continue;
      const points = [start, ...movable, endpoint];
      const result = await requestRoad(points, true, plan.departure, fetcher);
      const ordered = result.order.slice(1, -1).map(i => movable[i - 1]);
      if (segment.right === plan.stops.length && !plan.end) ordered.push(middle[middle.length - 1]);
      plan.stops.splice(segment.left + 1, middle.length, ...ordered);
    }
  }
  const points = [plan.start, ...plan.stops, ...(plan.end ? [plan.end] : [])];
  const result = await requestRoad(points, false, plan.departure, fetcher);
  const timing = scheduleRoute(plan, result.legs);
  if (optimize && timing.warnings.length) throw new Error("Optimized order does not fit the schedule: " + timing.warnings.join(" ") + " Your previous order is unchanged.");
  return { plan, road: { ...timing, geometry: result.geometry, legs: result.legs, distanceMeters: result.legs.reduce((n,l) => n + l.distanceMeters, 0), durationSeconds: result.legs.reduce((n,l) => n + l.durationSeconds, 0), checkedAt: new Date().toISOString() } };
}
