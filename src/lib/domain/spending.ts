export type SpendingKind = "recorded" | "commitment";

export type SpendingRow = {
  kind: SpendingKind;
  amountCents: number;
  occurredOn: Date;
  bookingId?: string | null;
  attendeeCount?: number | null;
};

export function summarizeSpending(rows: SpendingRow[], year: number) {
  const recorded = rows.filter((row) => row.kind === "recorded");
  const recordedBookingIds = new Set(
    recorded.map((row) => row.bookingId).filter((id): id is string => Boolean(id)),
  );
  const commitments = rows.filter(
    (row) =>
      row.kind === "commitment" &&
      !(row.bookingId && recordedBookingIds.has(row.bookingId)),
  );
  const recordedYearToDateCents = recorded
    .filter((row) => row.occurredOn.getUTCFullYear() === year)
    .reduce((sum, row) => sum + row.amountCents, 0);
  const upcomingCommitmentCents = commitments.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  return {
    recordedYearToDateCents,
    recordedMealCount: recorded.filter(
      (row) => row.occurredOn.getUTCFullYear() === year,
    ).length,
    upcomingCommitmentCents,
    upcomingCount: commitments.length,
  };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}$${(absolute / 100).toFixed(2)}`;
}
