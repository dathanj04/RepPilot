import { rangesOverlap } from "./reminders";

export const MEETING_STATUSES = [
  "PENDING",
  "APPROVED",
  "DECLINED",
  "RESCHEDULE_PROPOSED",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

const TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  PENDING: ["APPROVED", "DECLINED", "RESCHEDULE_PROPOSED", "EXPIRED", "CANCELLED"],
  APPROVED: ["CONFIRMED", "CANCELLED"],
  DECLINED: [],
  RESCHEDULE_PROPOSED: ["CONFIRMED", "DECLINED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["CANCELLED", "COMPLETED"],
  CANCELLED: [],
  COMPLETED: [],
  EXPIRED: [],
};

export const INVITATION_LIFETIMES = [24, 48, 168] as const;
export type InvitationLifetime = (typeof INVITATION_LIFETIMES)[number];

export const EXPIRED_INVITATION_MESSAGE =
  "This scheduling invitation has expired. To request another meeting or lunch and learn, please submit a new request or contact your representative.";

export function canTransition(from: string, to: string): boolean {
  if (!isMeetingStatus(from) || !isMeetingStatus(to)) return false;
  return TRANSITIONS[from].includes(to);
}

export function isMeetingStatus(value: string): value is MeetingStatus {
  return (MEETING_STATUSES as readonly string[]).includes(value);
}

export function resolveInvitationLifetime(requested: number, allowed: number[]): InvitationLifetime | null {
  if (!INVITATION_LIFETIMES.includes(requested as InvitationLifetime)) return null;
  if (!allowed.includes(requested)) return null;
  return requested as InvitationLifetime;
}

export type InvitationAccess = "open" | "expired" | "used" | "revoked";

export function invitationAccess(input: {
  now: Date;
  expiresAt: Date;
  status: string;
  useCount: number;
  maxUses: number;
  revoked: boolean;
}): InvitationAccess {
  if (input.revoked || input.status === "REVOKED") return "revoked";
  if (input.status === "USED" || input.useCount >= input.maxUses) return "used";
  if (input.status === "EXPIRED" || input.expiresAt <= input.now) return "expired";
  if (input.status !== "ACTIVE") return "revoked";
  return "open";
}

/** A pending request stays trackable after the link expires. Invitation expiry is not request expiry. */
export function requestExpiredBecauseTimePassed(input: { status: string; requestedStartsAt: Date; now: Date }): boolean {
  return (input.status === "PENDING" || input.status === "RESCHEDULE_PROPOSED") && input.requestedStartsAt <= input.now;
}

export function bufferedWindow(start: Date, end: Date, bufferMinutes: number) {
  const buffer = Math.max(0, bufferMinutes) * 60_000;
  return { start: new Date(start.getTime() - buffer), end: new Date(end.getTime() + buffer) };
}

export function conflictingLabel(input: {
  start: Date;
  end: Date;
  intervals: { start: Date; end: Date; label: string }[];
}): string | null {
  const hit = input.intervals.find((interval) => rangesOverlap(input.start, input.end, interval.start, interval.end));
  return hit?.label ?? null;
}

export type BusyInterval = { start: Date; end: Date };

export function parseGoogleFreeBusy(body: unknown): BusyInterval[] {
  if (!body || typeof body !== "object" || !("calendars" in body)) return [];
  const calendars = (body as { calendars?: Record<string, { busy?: { start?: string; end?: string }[] }> }).calendars ?? {};
  const intervals: BusyInterval[] = [];
  for (const calendar of Object.values(calendars)) {
    for (const busy of calendar.busy ?? []) {
      const start = busy.start ? new Date(busy.start) : null;
      const end = busy.end ? new Date(busy.end) : null;
      if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        intervals.push({ start, end });
      }
    }
  }
  return intervals;
}

export function parseMicrosoftSchedule(body: unknown): BusyInterval[] {
  if (!body || typeof body !== "object" || !("value" in body) || !Array.isArray((body as { value?: unknown }).value)) return [];
  const intervals: BusyInterval[] = [];
  for (const row of (body as { value: { scheduleItems?: { status?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }[] }[] }).value) {
    for (const item of row.scheduleItems ?? []) {
      const status = (item.status ?? "").toLowerCase();
      if (status === "free") continue;
      const start = item.start?.dateTime ? new Date(item.start.dateTime.endsWith("Z") ? item.start.dateTime : `${item.start.dateTime}Z`) : null;
      const end = item.end?.dateTime ? new Date(item.end.dateTime.endsWith("Z") ? item.end.dateTime : `${item.end.dateTime}Z`) : null;
      if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) intervals.push({ start, end });
    }
  }
  return intervals;
}
