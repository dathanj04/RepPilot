ALTER TABLE "Subscription" ADD COLUMN "trialStartedAt" TIMESTAMP(3), ADD COLUMN "trialEndsAt" TIMESTAMP(3);
-- Existing unpaid workspaces get one full trial at rollout, never a reset at login.
UPDATE "Subscription" SET "status" = 'trialing', "trialStartedAt" = CURRENT_TIMESTAMP, "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '14 days', "updatedAt" = CURRENT_TIMESTAMP WHERE "status" = 'demo';
INSERT INTO "Subscription" ("id", "organizationId", "plan", "status", "trialStartedAt", "trialEndsAt", "createdAt", "updatedAt")
SELECT 'trial_' || o."id", o."id", 'basic', 'trialing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Organization" o WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."organizationId" = o."id") ON CONFLICT ("organizationId") DO NOTHING;
