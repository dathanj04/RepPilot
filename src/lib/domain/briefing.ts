export function greetingFor(hour: number, name: string): string {
  const first = name.split(" ")[0] || name;
  if (hour < 12) return `Good morning, ${first}.`;
  if (hour < 17) return `Good afternoon, ${first}.`;
  return `Good evening, ${first}.`;
}

export function buildDailyBriefing(input: {
  plannedVisits: number;
  lunches: number;
  pendingConfirmations: number;
  followUpsDue: number;
  staleAccounts: number;
  staleDays: number;
}): string {
  const parts: string[] = [];
  if (input.staleAccounts > 0) {
    parts.push(
      `${input.staleAccounts} account${input.staleAccounts === 1 ? "" : "s"} that haven't been visited in ${input.staleDays} days`,
    );
  }
  if (input.lunches > 0) {
    parts.push(
      `${input.lunches} upcoming lunch${input.lunches === 1 ? "" : "es"}`,
    );
  }
  if (input.pendingConfirmations > 0) {
    parts.push(
      `${input.pendingConfirmations} lunch${input.pendingConfirmations === 1 ? "" : "es"} waiting on office confirmation`,
    );
  }
  if (input.followUpsDue > 0) {
    parts.push(
      `${input.followUpsDue} follow-up${input.followUpsDue === 1 ? "" : "s"} due today`,
    );
  }
  if (input.plannedVisits > 0 && parts.length === 0) {
    return `You have ${input.plannedVisits} planned visit${input.plannedVisits === 1 ? "" : "s"} today.`;
  }
  if (parts.length === 0) {
    return "You're clear on follow-ups and lunches. The map is the fastest way to choose a next stop.";
  }
  if (parts.length === 1) return `You have ${parts[0]}.`;
  const last = parts.pop();
  return `You have ${parts.join(", ")}, and ${last}.`;
}

const NUMBER_PATTERN = /\d+/g;

export function narrativeUsesOnlyAllowedNumbers(
  text: string,
  allowed: number[],
): boolean {
  const found = text.match(NUMBER_PATTERN)?.map(Number) ?? [];
  const allow = new Set(allowed);
  return found.every((value) => allow.has(value));
}

export function buildAccountBrief(input: {
  lastVisit: {
    at: Date;
    timeZone: string;
    summary: string;
    roles: string[];
    activities: string[];
  } | null;
  openTasks: { title: string }[];
}): { text: string; sourceLabels: string[] } {
  if (!input.lastVisit && input.openTasks.length === 0) {
    return {
      text: "No visits or open follow-ups are on file yet.",
      sourceLabels: [],
    };
  }
  const sentences: string[] = [];
  const sources: string[] = [];
  if (input.lastVisit) {
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone: input.lastVisit.timeZone,
      month: "long",
      day: "numeric",
    }).format(input.lastVisit.at);
    sentences.push(`Your last visit was ${when}.`);
    sources.push("Last check-in");
    const bits: string[] = [];
    if (input.lastVisit.roles.includes("office_manager")) {
      bits.push("you spoke with the office manager");
    }
    if (input.lastVisit.activities.includes("left_educational_materials")) {
      bits.push("left program materials");
    }
    if (input.lastVisit.summary.trim()) {
      bits.push(input.lastVisit.summary.trim().replace(/\.$/, ""));
    }
    if (bits.length > 0) {
      const [first, ...rest] = bits;
      const sentence =
        rest.length === 0
          ? `${first}.`
          : `${first}, and ${rest.join(", ")}.`;
      sentences.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
    }
  }
  if (input.openTasks.length > 0) {
    const first = input.openTasks[0]?.title;
    sentences.push(
      input.openTasks.length === 1
        ? `Open follow-up: ${first}.`
        : `${input.openTasks.length} follow-ups are still open, including ${first}.`,
    );
    sources.push("Open tasks");
  }
  return { text: sentences.join(" "), sourceLabels: sources };
}

export function draftFollowUpEmail(input: {
  repName: string;
  contactName: string | null;
  officeName: string;
  summary: string;
  nextStepTitles: string[];
}): { subject: string; body: string } {
  const greeting = input.contactName ? `Hi ${input.contactName.split(" ")[0]},` : "Hello,";
  const summary = input.summary.trim();
  const steps =
    input.nextStepTitles.length > 0
      ? `\n\nAs a next step, I will:\n${input.nextStepTitles.map((title) => `- ${title}`).join("\n")}`
      : "";
  const body = [
    greeting,
    "",
    `Thank you for the time at ${input.officeName}.`,
    summary ? `\n${summary}` : "",
    steps,
    "",
    "Please reach out with questions.",
    "",
    "Best,",
    input.repName,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return {
    subject: `Following up — ${input.officeName}`,
    body,
  };
}
