-- Visit intelligence, monthly themes, and CRM referral snapshots.
-- Existing CRM connections stay not connected. No referral counts are inserted.

ALTER TABLE "ExternalCRMConnection" ADD COLUMN "credentialCiphertext" TEXT;
ALTER TABLE "ExternalCRMConnection" ADD COLUMN "fieldMapping" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ExternalCRMConnection" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "ExternalCRMConnection" ADD COLUMN "lastSyncStatus" TEXT;

CREATE TABLE "MonthlyTheme" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetTerritoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetSpecialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "talkingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetMetric" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyTheme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitDetail" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "contactName" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "challenges" TEXT NOT NULL DEFAULT '',
    "resourcesRequested" TEXT NOT NULL DEFAULT '',
    "proposedCommitments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discussedThemeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiSummary" TEXT NOT NULL DEFAULT '',
    "nextTopic" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmReferralSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "connectionId" TEXT,
    "externalOrganizationId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "countSinceVisit" INTEGER,
    "count30" INTEGER,
    "count90" INTEGER,
    "previousCount30" INTEGER,
    "lastReferralAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmReferralSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeCrmMatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "connectionId" TEXT NOT NULL,
    "externalOrganizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PracticeCrmMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitBrief" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitBrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitDetail_interactionId_key" ON "VisitDetail"("interactionId");
CREATE UNIQUE INDEX "PracticeCrmMatch_connectionId_externalOrganizationId_key" ON "PracticeCrmMatch"("connectionId", "externalOrganizationId");
CREATE INDEX "MonthlyTheme_organizationId_status_startDate_idx" ON "MonthlyTheme"("organizationId", "status", "startDate");
CREATE INDEX "VisitDetail_organizationId_idx" ON "VisitDetail"("organizationId");
CREATE INDEX "CrmReferralSnapshot_organizationId_accountId_syncedAt_idx" ON "CrmReferralSnapshot"("organizationId", "accountId", "syncedAt");
CREATE INDEX "PracticeCrmMatch_organizationId_accountId_status_idx" ON "PracticeCrmMatch"("organizationId", "accountId", "status");
CREATE INDEX "VisitBrief_organizationId_accountId_createdAt_idx" ON "VisitBrief"("organizationId", "accountId", "createdAt");

ALTER TABLE "MonthlyTheme" ADD CONSTRAINT "MonthlyTheme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyTheme" ADD CONSTRAINT "MonthlyTheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitDetail" ADD CONSTRAINT "VisitDetail_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AccountInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmReferralSnapshot" ADD CONSTRAINT "CrmReferralSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmReferralSnapshot" ADD CONSTRAINT "CrmReferralSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmReferralSnapshot" ADD CONSTRAINT "CrmReferralSnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExternalCRMConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeCrmMatch" ADD CONSTRAINT "PracticeCrmMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeCrmMatch" ADD CONSTRAINT "PracticeCrmMatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticeCrmMatch" ADD CONSTRAINT "PracticeCrmMatch_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExternalCRMConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitBrief" ADD CONSTRAINT "VisitBrief_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitBrief" ADD CONSTRAINT "VisitBrief_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
