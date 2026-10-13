import type { MarkerTone } from "./catalog";

export function daysBetween(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function classifyAccount(input: {
  lastVisitAt: Date | null;
  nextFollowUpAt: Date | null;
  hasHighPriorityOverdue: boolean;
  now: Date;
  recentDays: number;
  overdueDays: number;
}): MarkerTone {
  const { lastVisitAt, nextFollowUpAt, hasHighPriorityOverdue, now } = input;
  if (!lastVisitAt) {
    if (hasHighPriorityOverdue || (nextFollowUpAt && nextFollowUpAt <= now)) {
      return hasHighPriorityOverdue ? "overdue" : "follow_up";
    }
    return "never";
  }
  const age = daysBetween(now, lastVisitAt);
  const followUpDue = Boolean(nextFollowUpAt && nextFollowUpAt <= now);
  if (hasHighPriorityOverdue || age >= input.overdueDays) return "overdue";
  if (followUpDue) return "follow_up";
  if (age <= input.recentDays) return "recent";
  return "steady";
}
