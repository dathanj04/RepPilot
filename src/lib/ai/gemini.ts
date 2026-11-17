import { extractCheckInDeterministic, type CheckInExtraction } from "../domain/extraction";
import { narrativeUsesOnlyAllowedNumbers } from "../domain/briefing";
import {modelJson} from "./provider";

export async function extractCheckIn(input: {
  transcript: string;
  now: Date;
  timeZone: string;
}): Promise<{ extraction: CheckInExtraction; provider: "gemini" | "deterministic" }> {
  return { extraction: extractCheckInDeterministic(input), provider: "deterministic" };
}

export async function polishBriefing(calculated: string, allowedNumbers: number[]) {
  const model = await modelJson(
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
