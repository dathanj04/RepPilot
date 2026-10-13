import {
  extractCheckInDeterministic,
  parseModelExtraction,
  type CheckInExtraction,
} from "../domain/extraction";
import { narrativeUsesOnlyAllowedNumbers } from "../domain/briefing";
import { logEvent } from "../logger";

export async function geminiJson(prompt: string, feature: string): Promise<unknown | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) {
      logEvent("error", "gemini.http", { feature, status: response.status });
      return null;
    }
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch (error) {
    logEvent("error", "gemini.failed", {
      feature,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function extractCheckIn(input: {
  transcript: string;
  now: Date;
  timeZone: string;
}): Promise<{ extraction: CheckInExtraction; provider: "gemini" | "deterministic" }> {
  const fallback = extractCheckInDeterministic(input);
  const model = await geminiJson(
    `You extract a healthcare field visit note. Return only JSON with keys interactionType, outcome, contactNames, contactRoles, summary, completedActivities, suggestedTasks, warnings.
Allowed interactionType: office_visit, educational_lunch, coffee_breakfast, phone_call, virtual_meeting, drop_off, follow_up, event, note, other, or null.
Allowed outcome: completed, scheduled, rescheduled, no_show, canceled, or null.
Allowed contactRoles: physician, office_manager, front_desk, medical_assistant, referral_coordinator, practice_administrator, other.
Allowed completedActivities: introduced_services, provided_program_overview, left_educational_materials, discussed_referral_process, answered_questions, met_office_manager, scheduled_lunch, completed_educational_lunch, sent_resources, no_contact_available, other.
Rules: Do not invent meetings, contacts, activities, referrals, or agreements. If unclear, use null or empty arrays. Do not include patient names or diagnoses; add a warning instead. Interpret relative dates in timezone ${input.timeZone} with today ${input.now.toISOString().slice(0, 10)}. suggestedTasks items are {title, dueDate as YYYY-MM-DD or null}.
Transcript:\n${input.transcript}`,
    "check_in_extract",
  );
  const parsed = parseModelExtraction(model);
  if (!parsed) return { extraction: fallback, provider: "deterministic" };
  return { extraction: parsed, provider: "gemini" };
}

export async function polishBriefing(calculated: string, allowedNumbers: number[]) {
  const model = await geminiJson(
    `Rewrite this daily briefing in one or two sentences. Use only these facts. Do not add accounts, counts, or activities. Return JSON {"text":"..."}.\n${calculated}`,
    "daily_briefing",
  );
  const text =
    model && typeof model === "object" && "text" in model && typeof model.text === "string"
      ? model.text
      : null;
  if (!text || !narrativeUsesOnlyAllowedNumbers(text, allowedNumbers)) return calculated;
  return text;
}
