import { expect, it } from "vitest";
import { deletionDueAt, formatDeletionDueDate } from "./deadlines";

it.each([
  ["2026-11-08T18:00:00Z", "2026-12-08T18:00:00.000Z"],
  ["2026-12-15T23:30:00Z", "2027-01-14T23:30:00.000Z"],
  ["2028-02-01T09:00:00Z", "2028-03-02T09:00:00.000Z"],
])("keeps the original request's 30-day deadline across calendar boundaries: %s", (requestedAt, dueAt) => {
  const original = new Date(requestedAt);
  expect(deletionDueAt(original).toISOString()).toBe(dueAt);
  expect(original.toISOString()).toBe(new Date(requestedAt).toISOString());
});

it("formats the disclosed due date in the same UTC calendar used for the deadline", () => {
  expect(formatDeletionDueDate(new Date("2026-11-08T23:59:00Z"))).toBe("December 8, 2026");
});
