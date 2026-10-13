import { formatInTimeZone } from "date-fns-tz";

export function formatWhen(date: Date, timeZone: string) {
  return formatInTimeZone(date, timeZone, "EEE, MMM d, yyyy · h:mm a");
}

export function formatDay(date: Date, timeZone: string) {
  return formatInTimeZone(date, timeZone, "EEE, MMM d");
}

export function formatTime(date: Date, timeZone: string) {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

export function hourInZone(date: Date, timeZone: string) {
  return Number(formatInTimeZone(date, timeZone, "H"));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
