import { straightLineMiles, type LatLng } from "./distance";
import { daysBetween } from "./markers";

export type RouteCandidate = {
  id: string;
  name: string;
  city: string;
  location: LatLng | null;
  lastVisitAt: Date | null;
};

export type RouteRecommendation = {
  accountId: string;
  reasons: string[];
  straightLineMiles: number | null;
};

export function recommendStops(input: {
  accounts: RouteCandidate[];
  tasks: {
    accountId: string | null;
    title: string;
    dueDate: Date | null;
    priority: string;
    status: string;
  }[];
  lunches: { accountId: string; city: string; startsAt: Date }[];
  now: Date;
  origin: LatLng | null;
  staleDays: number;
  limit: number;
}): RouteRecommendation[] {
  const scored = input.accounts.map((account) => {
    const reasons: string[] = [];
    const openTasks = input.tasks.filter(
      (task) => task.accountId === account.id && task.status === "OPEN",
    );
    for (const task of openTasks) {
      if (task.dueDate && task.dueDate <= input.now) {
        reasons.push(
          task.priority === "HIGH"
            ? `High-priority follow-up due: ${task.title}`
            : `Follow-up due: ${task.title}`,
        );
      }
    }
    if (!account.lastVisitAt) reasons.push("No visit on record");
    else {
      const age = daysBetween(input.now, account.lastVisitAt);
      if (age >= input.staleDays) {
        reasons.push(`Last visit was ${age} days ago`);
      }
    }
    const lunch = input.lunches.find((item) => item.city === account.city);
    if (lunch && lunch.accountId !== account.id) {
      reasons.push(`You already have a lunch in ${account.city}`);
    }
    const miles =
      input.origin && account.location
        ? straightLineMiles(input.origin, account.location)
        : null;
    const priorityBoost = reasons.some((reason) => reason.startsWith("High-priority"))
      ? 0
      : reasons.some((reason) => reason.startsWith("Follow-up"))
        ? 1
        : reasons.some((reason) => reason.startsWith("No visit") || reason.startsWith("Last visit"))
          ? 2
          : 3;
    return { account, reasons, miles, priorityBoost };
  });

  return scored
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => {
      if (a.priorityBoost !== b.priorityBoost) return a.priorityBoost - b.priorityBoost;
      if (a.miles != null && b.miles != null && a.miles !== b.miles) return a.miles - b.miles;
      return a.account.name.localeCompare(b.account.name);
    })
    .slice(0, input.limit)
    .map((item) => ({
      accountId: item.account.id,
      reasons: item.reasons,
      straightLineMiles: item.miles,
    }));
}

export function explainRoute(recommendations: RouteRecommendation[], names: Map<string, string>): string {
  if (recommendations.length === 0) {
    return "No accounts currently need a follow-up based on the records in RepPilot.";
  }
  const lines = recommendations.map((item) => {
    const name = names.get(item.accountId) ?? "Account";
    return `${name}: ${item.reasons.join("; ")}.`;
  });
  return lines.join(" ");
}
