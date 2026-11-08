import { createHash } from "node:crypto";

export const CRM_UNVERIFIED =
  "Referral activity could not be verified. Review your previous conversation and ask whether the practice needs support with the referral process.";

export const REFERRAL_FRESH_MS = 24 * 60 * 60 * 1000;

export type CrmFreshness = "verified" | "unavailable" | "failed" | "stale" | "ambiguous";

export type ReferralFact = {
  freshness: CrmFreshness;
  countSinceLastVisit: number | null;
  count30: number | null;
  count90: number | null;
  lastReferralAt: string | null;
  syncedAt: string | null;
  trend: "up" | "down" | "flat" | "unknown";
};

export type ThemeFact = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  specialties: string[];
  territoryIds: string[];
  userIds: string[];
  talkingPoints: string[];
  resources: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  priority: string;
};

export type VisitFact = {
  id: string;
  at: string;
  representativeName: string;
  summary: string;
  contactName: string | null;
};

export type BriefInput = {
  practiceName: string;
  specialty: string;
  territoryId: string | null;
  on: string;
  nowMs: number;
  visits: VisitFact[];
  openFollowUps: string[];
  referral: ReferralFact;
  themes: ThemeFact[];
};

export type VisitBrief = {
  objective: string;
  summary: string;
  talkingPoints: string[];
  opener: string;
  outstandingFollowUps: string[];
  referralInsight: string;
  referralCount: number | null;
  nextAction: string;
  evidence: string[];
  freshness: CrmFreshness;
  theme: { id: string; title: string; line: string } | null;
  fallback: boolean;
};

const INJECTION = /\b(ignore previous|system prompt|you are now|disregard)\b/i;
const PHI = /\b(patient|patients|diagnosis|diagnosed|mrn|medical record|date of birth|\bdob\b|ssn|social security)\b/i;

export function unavailableReferral(): ReferralFact {
  return {
    freshness: "unavailable",
    countSinceLastVisit: null,
    count30: null,
    count90: null,
    lastReferralAt: null,
    syncedAt: null,
    trend: "unknown",
  };
}

export function referralTrend(current30: number | null, previous30: number | null): ReferralFact["trend"] {
  if (current30 == null || previous30 == null) return "unknown";
  if (current30 > previous30) return "up";
  if (current30 < previous30) return "down";
  return "flat";
}

export function presentReferral(input: {
  syncStatus: string | null;
  syncedAtMs: number | null;
  nowMs: number;
  countSinceLastVisit: number | null;
  count30: number | null;
  count90: number | null;
  previousCount30: number | null;
  lastReferralAt: string | null;
  ambiguous: boolean;
}): ReferralFact {
  if (input.ambiguous) return { ...unavailableReferral(), freshness: "ambiguous" };
  if (!input.syncStatus || input.syncStatus === "not_connected" || input.syncStatus === "unavailable") {
    return unavailableReferral();
  }
  if (input.syncStatus === "failed") return { ...unavailableReferral(), freshness: "failed", syncedAt: input.syncedAtMs ? new Date(input.syncedAtMs).toISOString() : null };
  if (input.syncStatus !== "verified" || input.countSinceLastVisit == null || input.syncedAtMs == null) {
    return unavailableReferral();
  }
  if (input.nowMs - input.syncedAtMs > REFERRAL_FRESH_MS) {
    return { ...unavailableReferral(), freshness: "stale", syncedAt: new Date(input.syncedAtMs).toISOString() };
  }
  return {
    freshness: "verified",
    countSinceLastVisit: input.countSinceLastVisit,
    count30: input.count30,
    count90: input.count90,
    lastReferralAt: input.lastReferralAt,
    syncedAt: new Date(input.syncedAtMs).toISOString(),
    trend: referralTrend(input.count30, input.previousCount30),
  };
}

export function safeExcerpt(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !INJECTION.test(sentence) && !PHI.test(sentence));
  return sentences.join(" ").slice(0, 180);
}

export function themeVisibleToRep(
  theme: ThemeFact,
  input: { userId: string; territoryIds: string[]; on: string },
): boolean {
  if (theme.status !== "PUBLISHED") return false;
  if (input.on < theme.startDate || input.on > theme.endDate) return false;
  if (theme.userIds.length > 0 && !theme.userIds.includes(input.userId)) return false;
  if (theme.territoryIds.length > 0 && !theme.territoryIds.some((id) => input.territoryIds.includes(id))) return false;
  return true;
}

export function themeApplies(
  theme: ThemeFact,
  practice: { specialty: string; territoryId: string | null },
  on: string,
): boolean {
  if (theme.status !== "PUBLISHED") return false;
  if (on < theme.startDate || on > theme.endDate) return false;
  if (theme.specialties.length > 0 && !theme.specialties.some((specialty) => practice.specialty.toLowerCase().includes(specialty.toLowerCase()))) {
    return false;
  }
  if (theme.territoryIds.length > 0 && (!practice.territoryId || !theme.territoryIds.includes(practice.territoryId))) return false;
  return true;
}

function firstName(name: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(" ")[0] || trimmed;
}

function referralSentence(referral: ReferralFact, practiceName: string): { insight: string; count: number | null } {
  if (referral.freshness === "stale") {
    return { insight: `${CRM_UNVERIFIED} The last CRM sync is older than 24 hours, so those figures are not shown as current.`, count: null };
  }
  if (referral.freshness === "failed") {
    return { insight: `${CRM_UNVERIFIED} The last synchronization failed.`, count: null };
  }
  if (referral.freshness === "ambiguous") {
    return { insight: "This practice has an ambiguous CRM match. Referral counts stay unverified until an administrator approves the mapping.", count: null };
  }
  if (referral.freshness !== "verified" || referral.countSinceLastVisit == null) {
    return { insight: CRM_UNVERIFIED, count: null };
  }
  if (referral.countSinceLastVisit === 0) {
    return {
      insight: `During your last visit the practice discussed referrals, but no new referrals have been recorded. Focus on understanding whether there are barriers preventing referrals.`,
      count: 0,
    };
  }
  const trend = referral.trend === "up" ? " Referral activity is higher than the previous 30-day count." : referral.trend === "down" ? " Referral activity is lower than the previous 30-day count." : "";
  return {
    insight: `${practiceName} has submitted ${referral.countSinceLastVisit} referral${referral.countSinceLastVisit === 1 ? "" : "s"} since your last visit.${trend}`,
    count: referral.countSinceLastVisit,
  };
}

export function buildVisitBrief(input: BriefInput): VisitBrief {
  const last = input.visits[0] ?? null;
  const contact = firstName(last?.contactName ?? null);
  const who = contact ? contact : "the team";
  const excerpt = last ? safeExcerpt(last.summary) : "";
  const theme = input.themes.find((item) => themeApplies(item, { specialty: input.specialty, territoryId: input.territoryId }, input.on)) ?? null;
  const referral = referralSentence(input.referral, input.practiceName);
  const followUps = input.openFollowUps.map((item) => item.trim()).filter(Boolean);
  const evidence = [
    last ? `Last visit ${last.at} with ${last.representativeName}` : "No previous visit",
    ...followUps.slice(0, 3).map((item) => `Open follow-up: ${item}`),
    `CRM ${input.referral.freshness}`,
    ...(theme ? [`Theme ${theme.title}`] : []),
  ];

  let objective: string;
  let nextAction: string;
  if (followUps.length > 0) {
    objective = `Complete the open follow-up: ${followUps[0]}.`;
    nextAction = followUps[0] ?? "Follow up on the open commitment.";
  } else if (referral.count != null && referral.count > 0) {
    objective = "Strengthen the relationship and identify additional opportunities to support the practice.";
    nextAction = objective;
  } else if (referral.count === 0) {
    objective = "Identify and resolve any barriers to the referral process.";
    nextAction = objective;
  } else if (!last) {
    objective = `Introduce yourself at ${input.practiceName} and learn how the practice prefers to work with you.`;
    nextAction = "Learn who handles referrals and what the practice needs.";
  } else {
    objective = "Review the last conversation and ask whether the practice needs support with the referral process.";
    nextAction = objective;
  }

  const points: string[] = [];
  if (followUps[0]) points.push(`Start with the open commitment: ${followUps[0]}.`);
  if (referral.count != null && referral.count > 0) {
    points.push(`Thank ${who} for the ${referral.count} referral${referral.count === 1 ? "" : "s"}.`);
    points.push("Ask how the referral submission process went.");
  } else if (referral.count === 0) {
    points.push("Follow up on the previous referral conversation.");
    points.push(`Ask whether ${who} received the information they needed.`);
    points.push("Ask whether the practice ran into a barrier.");
  } else if (!last) {
    points.push("Introduce the educational purpose of the visit.");
    points.push("Ask who coordinates referrals.");
  } else {
    points.push("Review what you discussed last time before raising anything new.");
  }
  if (excerpt) points.push(`Pick up from the last note: ${excerpt}`);
  if (theme) points.push(theme.talkingPoints[0] ? `Monthly theme, ${theme.title}: ${theme.talkingPoints[0]}` : `Your manager’s current theme is ${theme.title}.`);
  if (points.length < 3) points.push("Ask whether any additional resources would help the team.");
  if (points.length < 3) points.push("Confirm the best person to contact after the visit.");
  const talkingPoints = points.slice(0, 5);

  let opener: string;
  if (referral.count != null && referral.count > 0) {
    opener = contact
      ? `Hey ${contact}! I wanted to stop by and thank you for the referrals you sent over. How has the referral process been working for your team?`
      : `I wanted to stop by and thank the team for the referrals you sent over. How has the referral process been working?`;
  } else if (referral.count === 0 && contact) {
    opener = `Hey ${contact}! Last time we talked about referrals. I wanted to check whether you received everything you needed from us.`;
  } else if (excerpt && contact) {
    opener = `Hey ${contact}! I wanted to follow up on our last conversation.`;
  } else if (!last) {
    opener = `Hi, I’m stopping by ${input.practiceName} to introduce myself and learn how we can support the practice.`;
  } else {
    opener = contact ? `Hey ${contact}! I wanted to follow up from the last visit.` : "I wanted to follow up from the last visit and see what would be most useful today.";
  }

  const themeLine = theme
    ? followUps.length > 0
      ? `Your manager’s current theme is ${theme.title}. The open follow-up comes first.`
      : `Your manager’s current theme is ${theme.title}. ${theme.description}`
    : null;

  const summary = !last
    ? "No previous visit is on file."
    : `${last.representativeName} last visited on ${last.at}.${excerpt ? ` ${excerpt}` : ""}`;

  return {
    objective,
    summary,
    talkingPoints,
    opener,
    outstandingFollowUps: followUps,
    referralInsight: referral.insight,
    referralCount: referral.count,
    nextAction,
    evidence,
    freshness: input.referral.freshness,
    theme: theme && themeLine ? { id: theme.id, title: theme.title, line: themeLine } : null,
    fallback: true,
  };
}

export function evidenceHash(input: BriefInput): string {
  const body = JSON.stringify({
    visit: input.visits[0]?.id ?? null,
    tasks: input.openFollowUps,
    sync: input.referral.syncedAt,
    freshness: input.referral.freshness,
    count: input.referral.countSinceLastVisit,
    themes: input.themes.filter((theme) => themeApplies(theme, input, input.on)).map((theme) => theme.id),
  });
  return createHash("sha256").update(body).digest("hex");
}

export function acceptModelBrief(text: string, allowedNumbers: number[], source: string): boolean {
  if (!text.trim() || INJECTION.test(text) || PHI.test(text) || INJECTION.test(source)) return false;
  const found = text.match(/\d+/g)?.map(Number) ?? [];
  return found.every((value) => allowedNumbers.includes(value));
}

export function summarizeSavedVisit(input: {
  summary: string;
  contactName: string | null;
  questions: string;
  tasks: string[];
}): { summary: string; nextTopic: string } {
  const excerpt = safeExcerpt(input.summary);
  const question = safeExcerpt(input.questions);
  const summary = excerpt
    ? `${input.contactName ? `${input.contactName}: ` : ""}${excerpt}`
    : "The visit was saved without a discussion note.";
  const nextTopic = question
    ? `Follow up on the question the practice asked: ${question}`
    : input.tasks[0]
      ? `The open follow-up is: ${input.tasks[0]}`
      : "Ask what the practice needs next.";
  return { summary, nextTopic };
}

export type PriorityCard = {
  accountId: string;
  name: string;
  reason: string;
  referralLabel: string;
  rank: number;
};

export function explainPriority(input: {
  accountId: string;
  name: string;
  openFollowUp: string | null;
  daysSinceVisit: number | null;
  staleDays: number;
  referral: ReferralFact;
  themeTitle: string | null;
}): PriorityCard {
  const reasons: string[] = [];
  let rank = 0;
  if (input.openFollowUp) {
    reasons.push(`${input.openFollowUp} remains open.`);
    rank += 100;
  }
  if (input.daysSinceVisit == null) {
    reasons.push("This practice has no visit on file.");
    rank += 30;
  } else if (input.daysSinceVisit >= input.staleDays) {
    reasons.push(`The last visit was ${input.daysSinceVisit} days ago.`);
    rank += 40;
  }
  if (input.themeTitle && input.openFollowUp) {
    reasons.push(`The monthly theme is ${input.themeTitle}. The open follow-up comes first.`);
    rank += 5;
  } else if (input.themeTitle) {
    reasons.push(`The practice matches the monthly theme ${input.themeTitle}.`);
    rank += 20;
  }
  let referralLabel = "Referral activity could not be verified.";
  if (input.referral.freshness === "verified" && input.referral.countSinceLastVisit != null) {
    referralLabel = `${input.referral.countSinceLastVisit} verified referral${input.referral.countSinceLastVisit === 1 ? "" : "s"} since the last visit.`;
    if (input.referral.trend === "down") reasons.push("Verified referral activity is lower than the previous period.");
    if (input.referral.trend === "up") reasons.push("Verified referral activity is higher than the previous period.");
    rank += 10;
  } else if (input.referral.freshness === "stale") {
    referralLabel = "CRM sync is stale. Counts are not shown as current.";
  }
  return {
    accountId: input.accountId,
    name: input.name,
    reason: reasons[0] ?? "No outstanding commitment is on file.",
    referralLabel,
    rank,
  };
}

export function campaignStats(input: {
  visits: number;
  discussed: number;
  followUps: number;
  verifiedReferrals: number | null;
}): { visits: number; discussed: number; followUps: number; referralLine: string } {
  return {
    visits: input.visits,
    discussed: input.discussed,
    followUps: input.followUps,
    referralLine: input.verifiedReferrals == null
      ? "Verified CRM referrals: not available. This is not zero, and it is not attributed to the theme."
      : `Verified CRM referrals in the sync window: ${input.verifiedReferrals}. This count is not attributed to the theme.`,
  };
}
