import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type ReminderKind = "SEVEN_DAY" | "FORTY_EIGHT_HOUR" | "NONRESPONSE_24H";

export function computeReminderInstants(
  appointmentUtc: Date,
  timeZone: string,
): Record<ReminderKind, Date> {
  const localDate = formatInTimeZone(appointmentUtc, timeZone, "yyyy-MM-dd");
  const localTime = formatInTimeZone(appointmentUtc, timeZone, "HH:mm:ss");
  const [year, month, day] = localDate.split("-").map(Number);
  const seven = new Date(Date.UTC(year!, (month ?? 1) - 1, day));
  seven.setUTCDate(seven.getUTCDate() - 7);
  const sevenDate = seven.toISOString().slice(0, 10);
  return {
    SEVEN_DAY: fromZonedTime(`${sevenDate}T${localTime}`, timeZone),
    FORTY_EIGHT_HOUR: new Date(appointmentUtc.getTime() - 48 * 60 * 60 * 1000),
    NONRESPONSE_24H: new Date(appointmentUtc.getTime() - 24 * 60 * 60 * 1000),
  };
}

export function reminderIdempotencyKey(
  bookingId: string,
  kind: ReminderKind,
  appointmentIso: string,
): string {
  return `reminder:${bookingId}:${kind}:${appointmentIso}`;
}

export function reminderAction(input: {
  kind: ReminderKind;
  bookingStatus: string;
  confirmedAt: Date | null;
}): "send" | "skip" {
  if (input.bookingStatus === "CANCELED") return "skip";
  if (
    (input.kind === "FORTY_EIGHT_HOUR" || input.kind === "NONRESPONSE_24H") &&
    input.confirmedAt
  ) {
    return "skip";
  }
  return "send";
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
