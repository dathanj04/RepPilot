import { DELETION_PROCESSING_DAYS } from "../legal";

/** Thirty calendar days in UTC; independent of the server's local timezone. */
export function deletionDueAt(requestedAt: Date) {
  const due = new Date(requestedAt);
  due.setUTCDate(due.getUTCDate() + DELETION_PROCESSING_DAYS);
  return due;
}

export function formatDeletionDueDate(requestedAt: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(deletionDueAt(requestedAt));
}
