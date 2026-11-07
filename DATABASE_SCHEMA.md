# Database schema

PostgreSQL through Prisma. The source of truth is `prisma/schema.prisma`. Migrations live in `prisma/migrations`. Money is integer cents. Secure links store SHA-256 hashes, not raw tokens.

Every customer record that belongs to a company carries `organizationId`. Queries in the app filter on the signed-in membership. `PLATFORM_ADMIN` is a separate organization and cannot open the representative application.

## Models that exist

- Identity: `User`, `Role`, `Organization`, `OrganizationMembership`, `Subscription`
- Territory: `Territory`, `TerritoryAssignment`, `Account`, `AccountContact`, `AccountAssignment`, `AccountNote`
- Activity: `AccountInteraction`, `InteractionParticipant`, `FollowUpTask`, `DailyRoute`, `RouteStop`
- Calendar: `CalendarConnection` (encrypted OAuth ciphertext and preferences), `CalendarEventMapping`
- Scheduling: `SchedulingInvitation`, `SchedulingSlot`, `MeetingRequest`, `MeetingStatusEvent`, `Meeting`
- Lunch: `LunchInvitation`, `InvitationTimeSlot`, `LunchBooking`, `LunchReminder`, `LunchConfirmation`, `LunchChangeRequest`
- Catering and policy: `CateringOrder`, `OrderReceipt`, `OfficeSpendingEntry`, `MealPolicy`, `PolicyRule`, `PolicyEvaluation`, `PolicyExceptionRequest`, `Approval`
- Integrations and AI: `ExternalCRMConnection`, `ExternalRecordMapping`, `AIInteraction`, `AIUsageRecord`
- Operations: `Notification`, `NotificationDelivery`, `AuditLog`, `SecureLinkToken`, `RateLimitBucket`

`AuditLog` records the actor, action, entity, and a small JSON metadata object. Account create, account update, and profile changes write a row. Passwords are never stored in metadata.

`RateLimitBucket` is shared across server processes. The key is a hash prefix of a public token, not the token itself.

## Models from the long-term plan that are not migrated

These names are product intent. They are not tables, and the app does not pretend they exist:

`Permission`, `AccountVisit` (visits are `AccountInteraction`), `OpportunityReference`, `OfficeProfile`, `OfficeStaffMembership`, `SchedulingInvitation`, `MeetingRequest`, `Meeting`, `MeetingAttendee`, `CateringRequest`, `Expense`, `CRMSyncJob`, `BillingAccount`, `UsageRecord`.

Adding them requires a new migration and an approval before any production database is changed.
