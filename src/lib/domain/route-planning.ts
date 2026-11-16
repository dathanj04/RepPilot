import { z } from "zod";

export const routePointSchema = z.object({
  key: z.string().min(1).max(100),
  accountId: z.string().max(100).nullable().default(null),
  name: z.string().trim().min(1).max(200),
  address: z.string().max(500).default(""),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
export const routeStopSchema = routePointSchema.extend({
  minutes: z.number().int().min(5).max(480).default(30),
  locked: z.boolean().default(false),
  appointment: z.string().datetime().nullable().default(null),
});
export const planningSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(120),
  departure: z.string().datetime(),
  workEnd: z.string().datetime(),
  breakStart: z.string().datetime().nullable().default(null),
  breakEnd: z.string().datetime().nullable().default(null),
  start: routePointSchema,
  end: routePointSchema.nullable().default(null),
  stops: z.array(routeStopSchema).min(1).max(20),
}).superRefine((p, ctx) => {
  if (new Set(p.stops.map(s => s.key)).size !== p.stops.length) ctx.addIssue({ code: "custom", message: "Route stop IDs must be unique." });
  const ids = p.stops.flatMap(s => s.accountId ? [s.accountId] : []);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "An account can only appear once in this route." });
  if (Date.parse(p.workEnd) <= Date.parse(p.departure)) ctx.addIssue({ code: "custom", message: "Working hours must end after departure." });
  if (!!p.breakStart !== !!p.breakEnd || (p.breakStart && p.breakEnd && Date.parse(p.breakEnd) <= Date.parse(p.breakStart))) ctx.addIssue({ code: "custom", message: "Choose a valid lunch break start and end." });
});
export type RoutePoint = z.infer<typeof routePointSchema>;
export type PlannedStop = z.infer<typeof routeStopSchema>;
export type RoutePlanning = z.infer<typeof planningSchema>;
export type RoadLeg = { durationSeconds: number; distanceMeters: number };
export type StopTiming = { key: string; arrival: string; departure: string; travelSeconds: number; waitingSeconds: number };
export type RoadResult = {
  geometry: [number, number][];
  legs: RoadLeg[];
  durationSeconds: number;
  distanceMeters: number;
  timings: StopTiming[];
  completedAt: string;
  visitSeconds: number;
  warnings: string[];
  checkedAt: string;
};
export type SavedPlanning = RoutePlanning & { road?: RoadResult };

export function scheduleRoute(plan: RoutePlanning, legs: RoadLeg[]) {
  if (legs.length !== plan.stops.length + (plan.end ? 1 : 0)) throw new Error("Driving legs do not match route stops.");
  let clock = Date.parse(plan.departure);
  const warnings: string[] = [];
  const timings: StopTiming[] = [];
  const pauseStart = plan.breakStart ? Date.parse(plan.breakStart) : null;
  const pauseEnd = plan.breakEnd ? Date.parse(plan.breakEnd) : null;
  const avoidBreak = (start: number, duration: number) => pauseStart != null && pauseEnd != null && start < pauseEnd && start + duration > pauseStart ? Math.max(start, pauseEnd) : start;
  plan.stops.forEach((stop, i) => {
    const travel = legs[i].durationSeconds * 1000;
    clock = avoidBreak(clock, travel);
    clock += travel;
    const reached = clock;
    if (stop.appointment) {
      const fixed = Date.parse(stop.appointment);
      if (clock > fixed + 60000) warnings.push(stop.name + ": arrival is after its fixed appointment.");
      clock = Math.max(clock, fixed);
    }
    const visit = stop.minutes * 60000;
    const available = avoidBreak(clock, visit);
    if (stop.appointment && available !== clock) warnings.push(stop.name + ": fixed appointment overlaps the lunch break.");
    clock = available;
    const arrival = clock;
    clock += visit;
    timings.push({ key: stop.key, arrival: new Date(arrival).toISOString(), departure: new Date(clock).toISOString(), travelSeconds: legs[i].durationSeconds, waitingSeconds: Math.max(0, (arrival - reached) / 1000) });
  });
  if (plan.end) { const duration = legs[legs.length - 1].durationSeconds * 1000; clock = avoidBreak(clock, duration) + duration; }
  if (clock > Date.parse(plan.workEnd)) warnings.push("Route finishes after working hours. Shorten visits, remove stops, or adjust your schedule.");
  return { timings, completedAt: new Date(clock).toISOString(), visitSeconds: plan.stops.reduce((n, s) => n + s.minutes * 60, 0), warnings };
}

export function optimizationSegments(plan: RoutePlanning) {
  // Locked / appointment stops remain at the same sequence index.
  const anchors = [-1, ...plan.stops.flatMap((s, i) => s.locked || s.appointment ? [i] : []), plan.stops.length];
  return anchors.slice(1).map((right, i) => ({ left: anchors[i], right }));
}

export function readPlanning(value: unknown): SavedPlanning | null {
  const parsed = planningSchema.safeParse(value);
  if (!parsed.success) return null;
  const road = (value as SavedPlanning).road;
  return { ...parsed.data, ...(road && Array.isArray(road.geometry) && Array.isArray(road.timings) ? { road } : {}) };
}
