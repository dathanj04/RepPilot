import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { ACTIVITIES, CONTACT_ROLES, INTERACTION_TYPE_IDS, OUTCOMES } from "./catalog";

const activityIds = ACTIVITIES.map((item) => item.id);
const roleIds = CONTACT_ROLES.map((item) => item.id);
const outcomeIds = OUTCOMES.map((item) => item.id);

export const checkInExtractionSchema = z.object({
  interactionType: z.enum(INTERACTION_TYPE_IDS as [string, ...string[]]).nullable(),
  outcome: z.enum(outcomeIds as [string, ...string[]]).nullable(),
  contactNames: z.array(z.string().min(1).max(80)).max(5),
  contactRoles: z.array(z.enum(roleIds as [string, ...string[]])).max(6),
  summary: z.string().max(500),
  completedActivities: z.array(z.enum(activityIds as [string, ...string[]])).max(11),
  suggestedTasks: z
    .array(
      z.object({
        title: z.string().min(1).max(140),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      }),
    )
    .max(5),
  warnings: z.array(z.string()).max(8),
});

export type CheckInExtraction = z.infer<typeof checkInExtractionSchema>;

const PHI_PATTERN =
  /\b(patient|patients|diagnosis|diagnosed|mrn|medical record|date of birth|\bdob\b|ssn|social security)\b/i;

export function calendarDate(now: Date, timeZone: string): string {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function resolveRelativeDate(
  text: string,
  now: Date,
  timeZone: string,
): string | null {
  const today = calendarDate(now, timeZone);
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1);
  if (/\bnext week\b/.test(lower)) return addDays(today, 7);
  const inDays = lower.match(/\bin (\d{1,2}) days?\b/);
  if (inDays?.[1]) return addDays(today, Number(inDays[1]));
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const weekday = formatInTimeZone(now, timeZone, "EEEE").toLowerCase();
  const todayIndex = weekdays.indexOf(weekday);
  for (let index = 0; index < weekdays.length; index += 1) {
    const name = weekdays[index];
    if (!name) continue;
    if (new RegExp(`\\bnext ${name}\\b`).test(lower)) {
      let delta = (index - todayIndex + 7) % 7;
      if (delta === 0) delta = 7;
      return addDays(today, delta);
    }
  }
  return null;
}

function sentenceWithoutPhi(text: string): { summary: string; warned: boolean } {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const kept = sentences.filter((sentence) => !PHI_PATTERN.test(sentence));
  return {
    summary: kept.join(" ").slice(0, 500),
    warned: kept.length !== sentences.length || PHI_PATTERN.test(text),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function extractCheckInDeterministic(input: {
  transcript: string;
  now: Date;
  timeZone: string;
}): CheckInExtraction {
  const text = input.transcript.trim();
  const lower = text.toLowerCase();
  const warnings: string[] = [];
  const { summary, warned } = sentenceWithoutPhi(text);
  if (warned) {
    warnings.push(
      "Patient-identifying details were left out. Do not store patient information in visit notes.",
    );
  }
  if (text.length < 12) {
    warnings.push("The note is very short. Review the fields before saving.");
  }

  let interactionType: string | null = null;
  if (/\b(just left|stopped by|visited|came by|office visit)\b/.test(lower)) {
    interactionType = "office_visit";
  } else if (/\b(lunch)\b/.test(lower) && /\b(had|completed|finished)\b/.test(lower)) {
    interactionType = "educational_lunch";
  } else if (/\b(coffee|breakfast)\b/.test(lower)) {
    interactionType = "coffee_breakfast";
  } else if (/\b(called|phone)\b/.test(lower)) {
    interactionType = "phone_call";
  } else if (/\b(zoom|virtual|teams)\b/.test(lower)) {
    interactionType = "virtual_meeting";
  } else if (/\b(drop(?:ped)? off)\b/.test(lower)) {
    interactionType = "drop_off";
  } else if (/\bmet with\b/.test(lower)) {
    interactionType = "office_visit";
  }

  let outcome: string | null = null;
  if (/\bno[- ]show\b/.test(lower)) outcome = "no_show";
  else if (/\bcancel(?:ed|led)\b/.test(lower)) outcome = "canceled";
  else if (/\breschedul/.test(lower)) outcome = "rescheduled";
  else if (interactionType && interactionType !== "note") outcome = "completed";

  const contactNames: string[] = [];
  const nameMatch = text.match(
    /\bmet with(?: the)?(?: office manager| front desk| physician| doctor| medical assistant| referral coordinator| practice administrator)?\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i,
  );
  if (nameMatch?.[1]) contactNames.push(nameMatch[1]);

  const contactRoles: string[] = [];
  if (/\boffice manager\b/i.test(text)) contactRoles.push("office_manager");
  if (/\bfront desk\b/i.test(text)) contactRoles.push("front_desk");
  if (/\b(physician|doctor)\b/i.test(text)) contactRoles.push("physician");
  if (/\bmedical assistant\b/i.test(text)) contactRoles.push("medical_assistant");
  if (/\breferral coordinator\b/i.test(text)) contactRoles.push("referral_coordinator");
  if (/\bpractice administrator\b/i.test(text)) contactRoles.push("practice_administrator");

  const completedActivities: string[] = [];
  if (/\bintroduced\b/.test(lower)) completedActivities.push("introduced_services");
  if (/\b(program overview|overview of the program)\b/.test(lower)) {
    completedActivities.push("provided_program_overview");
  }
  if (/\b(left|dropped off)\b.*\b(material|brochure|overview)\b/.test(lower) || /\beducational materials\b/.test(lower) && /\bleft\b/.test(lower)) {
    completedActivities.push("left_educational_materials");
  }
  if (/\breferral process\b/.test(lower)) completedActivities.push("discussed_referral_process");
  if (/\banswered (their |office )?questions\b/.test(lower)) {
    completedActivities.push("answered_questions");
  }
  if (/\bmet (with )?(the )?office manager\b/.test(lower)) {
    completedActivities.push("met_office_manager");
  }
  if (/\b(scheduled|booked) (a |an |the )?lunch\b/.test(lower)) {
    completedActivities.push("scheduled_lunch");
  }
  if (/\b(completed|finished) (the |an |a )?educational lunch\b/.test(lower)) {
    completedActivities.push("completed_educational_lunch");
  }
  if (/\b(sent|emailed) (them |the )?(resources|materials|overview)\b/.test(lower)) {
    completedActivities.push("sent_resources");
  }
  if (/\bno (one|contact) (was )?available\b/.test(lower)) {
    completedActivities.push("no_contact_available");
  }

  const suggestedTasks: { title: string; dueDate: string | null }[] = [];
  if (/\bemail\b/.test(lower) && /\b(tomorrow|next|follow|i'll|i will|need to)\b/.test(lower)) {
    suggestedTasks.push({
      title: "Email updated overview",
      dueDate: resolveRelativeDate(lower, input.now, input.timeZone),
    });
  }
  if (/\bfollow up\b/.test(lower)) {
    const due = /\bnext tuesday\b/.test(lower)
      ? resolveRelativeDate("next tuesday", input.now, input.timeZone)
      : resolveRelativeDate(lower, input.now, input.timeZone);
    suggestedTasks.push({ title: "Follow up with office", dueDate: due });
  }
  if (/\b(schedule|need to schedule) (a |an )?lunch\b/.test(lower)) {
    suggestedTasks.push({
      title: "Schedule a lunch",
      dueDate: resolveRelativeDate(lower, input.now, input.timeZone),
    });
  }

  if (!interactionType) {
    warnings.push("Interaction type was not clear. Choose it before saving.");
  }

  const parsed = checkInExtractionSchema.parse({
    interactionType,
    outcome,
    contactNames: unique(contactNames),
    contactRoles: unique(contactRoles),
    summary,
    completedActivities: unique(completedActivities),
    suggestedTasks,
    warnings: unique(warnings),
  });
  return parsed;
}

export function parseModelExtraction(value: unknown): CheckInExtraction | null {
  const parsed = checkInExtractionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
