import { z } from "zod";

export const orgSettingsSchema = z.object({
  workdayStart: z.string().default("08:00"),
  workdayEnd: z.string().default("17:00"),
  visitMinutes: z.number().int().positive().default(20),
  recentVisitDays: z.number().int().positive().default(14),
  overdueVisitDays: z.number().int().positive().default(45),
  staleBriefingDays: z.number().int().positive().default(30),
  invitationExpiryHours: z.number().int().positive().default(48),
  allowedInvitationHours: z.array(z.union([z.literal(24), z.literal(48), z.literal(168)])).default([24, 48, 168]),
  aiEnabled: z.boolean().default(true),
  monthlyAiLimit: z.number().int().nonnegative().default(200),
  previewCapabilities: z.array(z.string()).default([]),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export function parseOrgSettings(value: unknown): OrgSettings {
  const parsed = orgSettingsSchema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  return orgSettingsSchema.parse({});
}

export const brandingSchema = z.object({
  displayName: z.string().default("RepPilot AI"),
  emailFromName: z.string().default("RepPilot AI"),
});

export function parseBranding(value: unknown) {
  const parsed = brandingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : brandingSchema.parse({});
}
