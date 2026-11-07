-- Approval-gated scheduling invitations. Existing lunch rows are unchanged.

ALTER TABLE "CalendarConnection" ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "SchedulingInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "accountId" TEXT,
    "invitationType" TEXT NOT NULL DEFAULT 'meeting',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lifetimeHours" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "publicContact" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingSlot" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "accountId" TEXT,
    "officeName" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT,
    "purpose" TEXT NOT NULL,
    "requestedStartsAt" TIMESTAMP(3) NOT NULL,
    "requestedEndsAt" TIMESTAMP(3) NOT NULL,
    "proposedStartsAt" TIMESTAMP(3),
    "proposedEndsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingStatusEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "syncState" TEXT NOT NULL DEFAULT 'not_connected',
    "externalEventId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SecureLinkToken" ADD COLUMN "schedulingInvitationId" TEXT;
ALTER TABLE "SecureLinkToken" ADD COLUMN "meetingRequestId" TEXT;

CREATE INDEX "SchedulingInvitation_organizationId_status_expiresAt_idx" ON "SchedulingInvitation"("organizationId", "status", "expiresAt");
CREATE INDEX "SchedulingInvitation_createdById_idx" ON "SchedulingInvitation"("createdById");
CREATE INDEX "SchedulingSlot_invitationId_startsAt_idx" ON "SchedulingSlot"("invitationId", "startsAt");
CREATE INDEX "MeetingRequest_organizationId_status_requestedStartsAt_idx" ON "MeetingRequest"("organizationId", "status", "requestedStartsAt");
CREATE INDEX "MeetingRequest_invitationId_idx" ON "MeetingRequest"("invitationId");
CREATE INDEX "MeetingStatusEvent_requestId_createdAt_idx" ON "MeetingStatusEvent"("requestId", "createdAt");
CREATE UNIQUE INDEX "Meeting_requestId_key" ON "Meeting"("requestId");
CREATE INDEX "Meeting_organizationId_userId_startsAt_idx" ON "Meeting"("organizationId", "userId", "startsAt");
CREATE INDEX "SecureLinkToken_schedulingInvitationId_idx" ON "SecureLinkToken"("schedulingInvitationId");
CREATE INDEX "SecureLinkToken_meetingRequestId_idx" ON "SecureLinkToken"("meetingRequestId");

ALTER TABLE "SchedulingInvitation" ADD CONSTRAINT "SchedulingInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulingInvitation" ADD CONSTRAINT "SchedulingInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulingInvitation" ADD CONSTRAINT "SchedulingInvitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchedulingSlot" ADD CONSTRAINT "SchedulingSlot_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SchedulingInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SchedulingInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingStatusEvent" ADD CONSTRAINT "MeetingStatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MeetingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MeetingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecureLinkToken" ADD CONSTRAINT "SecureLinkToken_schedulingInvitationId_fkey" FOREIGN KEY ("schedulingInvitationId") REFERENCES "SchedulingInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecureLinkToken" ADD CONSTRAINT "SecureLinkToken_meetingRequestId_fkey" FOREIGN KEY ("meetingRequestId") REFERENCES "MeetingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
