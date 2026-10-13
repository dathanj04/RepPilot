-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "title" TEXT,
    "notificationPrefs" JSONB NOT NULL DEFAULT '{"inApp":true,"emailOperational":true}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priceMonthlyCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boundary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryAssignment" (
    "id" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerritoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "territoryId" TEXT,
    "name" TEXT NOT NULL,
    "officeType" TEXT NOT NULL DEFAULT 'Clinic',
    "specialty" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "email" TEXT,
    "fax" TEXT,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "providerCount" INTEGER NOT NULL DEFAULT 1,
    "officeHours" TEXT,
    "generalNotes" TEXT,
    "referralCommunicationPreference" TEXT,
    "lastVisitAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountInteraction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "completedActivities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionParticipant" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,

    CONSTRAINT "InteractionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "ownerId" TEXT NOT NULL,
    "interactionId" TEXT,
    "lunchBookingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRoute" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalAccountEmail" TEXT,
    "credentialCiphertext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'internal',
    "externalEventId" TEXT,
    "lunchBookingId" TEXT,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "syncState" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "selectedSlotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LunchInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationTimeSlot" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',

    CONSTRAINT "InvitationTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchBooking" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "invitationId" TEXT,
    "slotStartsAt" TIMESTAMP(3) NOT NULL,
    "slotEndsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expectedAttendees" INTEGER NOT NULL,
    "confirmedAttendees" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByName" TEXT,
    "timezone" TEXT NOT NULL,
    "notes" TEXT,
    "mealPreferences" TEXT,
    "deliveryInstructions" TEXT,
    "estimatedBudgetCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LunchBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "idempotencyKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LunchReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchConfirmation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "attendeeCount" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LunchConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchChangeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "requestedAttendees" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LunchChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CateringOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "vendor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "estimatedAmountCents" INTEGER,
    "finalAmountCents" INTEGER,
    "confirmedAttendees" INTEGER,
    "targetDeliveryAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "orderReference" TEXT,
    "deliveryInstructions" TEXT,
    "groupOrderUrl" TEXT,
    "externalHandoffAt" TIMESTAMP(3),
    "handoffVendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CateringOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReceipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "note" TEXT,
    "reference" TEXT,
    "amountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeSpendingEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "attendeeCount" INTEGER,
    "perPersonCents" INTEGER,
    "vendor" TEXT,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "policyStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeSpendingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "perPersonCapCents" INTEGER NOT NULL,
    "entertainmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "referralLinkedMealsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "exceptionsPermitted" BOOLEAN NOT NULL DEFAULT true,
    "educationalPurposeRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "overridable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT,
    "orderId" TEXT,
    "policyId" TEXT,
    "result" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyExceptionRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT,
    "orderId" TEXT,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "prohibited" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyExceptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "decidedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInteraction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inputExcerpt" TEXT NOT NULL,
    "outputJson" JSONB,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCRMConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCRMConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRecordMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "localType" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRecordMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "toAddress" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecureLinkToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "accountId" TEXT,
    "invitationId" TEXT,
    "bookingId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecureLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_roleId_idx" ON "OrganizationMembership"("organizationId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "Territory_organizationId_idx" ON "Territory"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TerritoryAssignment_territoryId_userId_key" ON "TerritoryAssignment"("territoryId", "userId");

-- CreateIndex
CREATE INDEX "Account_organizationId_idx" ON "Account"("organizationId");

-- CreateIndex
CREATE INDEX "Account_organizationId_name_idx" ON "Account"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Account_organizationId_latitude_longitude_idx" ON "Account"("organizationId", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "Account_organizationId_lastVisitAt_idx" ON "Account"("organizationId", "lastVisitAt");

-- CreateIndex
CREATE INDEX "Account_organizationId_nextFollowUpAt_idx" ON "Account"("organizationId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "AccountContact_organizationId_accountId_idx" ON "AccountContact"("organizationId", "accountId");

-- CreateIndex
CREATE INDEX "AccountAssignment_organizationId_userId_idx" ON "AccountAssignment"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAssignment_accountId_userId_key" ON "AccountAssignment"("accountId", "userId");

-- CreateIndex
CREATE INDEX "AccountNote_organizationId_accountId_createdAt_idx" ON "AccountNote"("organizationId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountInteraction_organizationId_accountId_occurredAt_idx" ON "AccountInteraction"("organizationId", "accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AccountInteraction_organizationId_userId_occurredAt_idx" ON "AccountInteraction"("organizationId", "userId", "occurredAt");

-- CreateIndex
CREATE INDEX "InteractionParticipant_interactionId_idx" ON "InteractionParticipant"("interactionId");

-- CreateIndex
CREATE INDEX "FollowUpTask_organizationId_ownerId_status_dueDate_idx" ON "FollowUpTask"("organizationId", "ownerId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FollowUpTask_organizationId_accountId_status_idx" ON "FollowUpTask"("organizationId", "accountId", "status");

-- CreateIndex
CREATE INDEX "DailyRoute_organizationId_userId_routeDate_idx" ON "DailyRoute"("organizationId", "userId", "routeDate");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_position_key" ON "RouteStop"("routeId", "position");

-- CreateIndex
CREATE INDEX "CalendarConnection_organizationId_idx" ON "CalendarConnection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_provider_key" ON "CalendarConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "CalendarEventMapping_organizationId_userId_startsAt_idx" ON "CalendarEventMapping"("organizationId", "userId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEventMapping_lunchBookingId_idx" ON "CalendarEventMapping"("lunchBookingId");

-- CreateIndex
CREATE INDEX "LunchInvitation_organizationId_status_expiresAt_idx" ON "LunchInvitation"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "LunchInvitation_accountId_idx" ON "LunchInvitation"("accountId");

-- CreateIndex
CREATE INDEX "InvitationTimeSlot_invitationId_startsAt_idx" ON "InvitationTimeSlot"("invitationId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "LunchBooking_invitationId_key" ON "LunchBooking"("invitationId");

-- CreateIndex
CREATE INDEX "LunchBooking_organizationId_representativeId_slotStartsAt_idx" ON "LunchBooking"("organizationId", "representativeId", "slotStartsAt");

-- CreateIndex
CREATE INDEX "LunchBooking_organizationId_status_slotStartsAt_idx" ON "LunchBooking"("organizationId", "status", "slotStartsAt");

-- CreateIndex
CREATE INDEX "LunchBooking_accountId_slotStartsAt_idx" ON "LunchBooking"("accountId", "slotStartsAt");

-- CreateIndex
CREATE UNIQUE INDEX "LunchReminder_idempotencyKey_key" ON "LunchReminder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LunchReminder_status_scheduledFor_idx" ON "LunchReminder"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "LunchReminder_bookingId_idx" ON "LunchReminder"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "LunchConfirmation_bookingId_key" ON "LunchConfirmation"("bookingId");

-- CreateIndex
CREATE INDEX "LunchChangeRequest_organizationId_status_idx" ON "LunchChangeRequest"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CateringOrder_bookingId_key" ON "CateringOrder"("bookingId");

-- CreateIndex
CREATE INDEX "CateringOrder_organizationId_accountId_idx" ON "CateringOrder"("organizationId", "accountId");

-- CreateIndex
CREATE INDEX "CateringOrder_organizationId_status_idx" ON "CateringOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OfficeSpendingEntry_organizationId_accountId_occurredOn_idx" ON "OfficeSpendingEntry"("organizationId", "accountId", "occurredOn");

-- CreateIndex
CREATE INDEX "OfficeSpendingEntry_organizationId_kind_occurredOn_idx" ON "OfficeSpendingEntry"("organizationId", "kind", "occurredOn");

-- CreateIndex
CREATE INDEX "MealPolicy_organizationId_active_idx" ON "MealPolicy"("organizationId", "active");

-- CreateIndex
CREATE INDEX "PolicyEvaluation_organizationId_bookingId_idx" ON "PolicyEvaluation"("organizationId", "bookingId");

-- CreateIndex
CREATE INDEX "PolicyExceptionRequest_organizationId_status_idx" ON "PolicyExceptionRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Approval_organizationId_subjectType_subjectId_idx" ON "Approval"("organizationId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AIInteraction_organizationId_purpose_createdAt_idx" ON "AIInteraction"("organizationId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageRecord_organizationId_createdAt_idx" ON "AIUsageRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCRMConnection_organizationId_provider_key" ON "ExternalCRMConnection"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ExternalRecordMapping_organizationId_localType_localId_idx" ON "ExternalRecordMapping"("organizationId", "localType", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRecordMapping_connectionId_localType_localId_key" ON "ExternalRecordMapping"("connectionId", "localType", "localId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_organizationId_createdAt_idx" ON "NotificationDelivery"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecureLinkToken_tokenHash_key" ON "SecureLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SecureLinkToken_organizationId_purpose_idx" ON "SecureLinkToken"("organizationId", "purpose");

-- CreateIndex
CREATE INDEX "SecureLinkToken_invitationId_idx" ON "SecureLinkToken"("invitationId");

-- CreateIndex
CREATE INDEX "SecureLinkToken_bookingId_idx" ON "SecureLinkToken"("bookingId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountContact" ADD CONSTRAINT "AccountContact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountNote" ADD CONSTRAINT "AccountNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountNote" ADD CONSTRAINT "AccountNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInteraction" ADD CONSTRAINT "AccountInteraction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInteraction" ADD CONSTRAINT "AccountInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionParticipant" ADD CONSTRAINT "InteractionParticipant_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AccountInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AccountInteraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_lunchBookingId_fkey" FOREIGN KEY ("lunchBookingId") REFERENCES "LunchBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRoute" ADD CONSTRAINT "DailyRoute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRoute" ADD CONSTRAINT "DailyRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DailyRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventMapping" ADD CONSTRAINT "CalendarEventMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventMapping" ADD CONSTRAINT "CalendarEventMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchInvitation" ADD CONSTRAINT "LunchInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchInvitation" ADD CONSTRAINT "LunchInvitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchInvitation" ADD CONSTRAINT "LunchInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationTimeSlot" ADD CONSTRAINT "InvitationTimeSlot_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "LunchInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchBooking" ADD CONSTRAINT "LunchBooking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchBooking" ADD CONSTRAINT "LunchBooking_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchBooking" ADD CONSTRAINT "LunchBooking_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchBooking" ADD CONSTRAINT "LunchBooking_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "LunchInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchReminder" ADD CONSTRAINT "LunchReminder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "LunchBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchConfirmation" ADD CONSTRAINT "LunchConfirmation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "LunchBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchChangeRequest" ADD CONSTRAINT "LunchChangeRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "LunchBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringOrder" ADD CONSTRAINT "CateringOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringOrder" ADD CONSTRAINT "CateringOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "LunchBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringOrder" ADD CONSTRAINT "CateringOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReceipt" ADD CONSTRAINT "OrderReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CateringOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSpendingEntry" ADD CONSTRAINT "OfficeSpendingEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSpendingEntry" ADD CONSTRAINT "OfficeSpendingEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSpendingEntry" ADD CONSTRAINT "OfficeSpendingEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "LunchBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPolicy" ADD CONSTRAINT "MealPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "MealPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyEvaluation" ADD CONSTRAINT "PolicyEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyExceptionRequest" ADD CONSTRAINT "PolicyExceptionRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyExceptionRequest" ADD CONSTRAINT "PolicyExceptionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCRMConnection" ADD CONSTRAINT "ExternalCRMConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordMapping" ADD CONSTRAINT "ExternalRecordMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExternalCRMConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecureLinkToken" ADD CONSTRAINT "SecureLinkToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecureLinkToken" ADD CONSTRAINT "SecureLinkToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecureLinkToken" ADD CONSTRAINT "SecureLinkToken_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "LunchInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecureLinkToken" ADD CONSTRAINT "SecureLinkToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "LunchBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
