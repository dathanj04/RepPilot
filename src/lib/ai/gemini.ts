import { extractCheckInDeterministic, type CheckInExtraction } from "../domain/extraction";
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
        signal: AbortSignal.timeout(10000),
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
  return { extraction: extractCheckInDeterministic(input), provider: "deterministic" };
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
