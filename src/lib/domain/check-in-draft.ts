import { z } from "zod";

export const checkInDraftSchema = z.object({
  summary: z.string(), type: z.string(), outcome: z.string().nullable(),
  roles: z.array(z.string()), contactId: z.string(), otherName: z.string(),
  activities: z.array(z.string()), steps: z.array(z.string()), followUpDate: z.string(),
  questions: z.string(), challenges: z.string(), resourcesRequested: z.string(), discussedTheme: z.boolean(),
});

export function draftStorageKey(organizationId: string, userId: string, accountId: string) {
  return `reppilot-draft-v2-${encodeURIComponent(organizationId)}-${encodeURIComponent(userId)}-${encodeURIComponent(accountId)}`;
}

export function readCheckInDraft(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = checkInDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
