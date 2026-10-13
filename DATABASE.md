# Database

PostgreSQL is accessed with Prisma 7. The schema is `prisma/schema.prisma`. The client is generated to `src/generated/prisma` and is not committed. `npm install` runs `prisma generate`.

Configuration lives in `prisma7.config.ts` because Prisma 7 reads the connection string from that file, not from the schema `datasource` block.

```bash
npx prisma migrate dev
npx prisma migrate deploy
npm run db:seed
```

The initial migration is `prisma/migrations/20261013130854_init`.

## Tenancy

Customer data carries `organizationId`. Secure links, spending, tasks, lunches, notifications, and audit rows are included. The platform organization does not share accounts with Example Healthcare Services.

## Main records

- Identity: `User`, `Role`, `Organization`, `OrganizationMembership`, `Subscription`
- Territory: `Territory`, `TerritoryAssignment`, `Account`, `AccountContact`, `AccountAssignment`, `AccountNote`
- Activity: `AccountInteraction`, `InteractionParticipant`, `FollowUpTask`, `DailyRoute`, `RouteStop`
- Calendar: `CalendarConnection`, `CalendarEventMapping`
- Lunch: `LunchInvitation`, `InvitationTimeSlot`, `LunchBooking`, `LunchReminder`, `LunchConfirmation`, `LunchChangeRequest`
- Catering: `CateringOrder`, `OrderReceipt`, `OfficeSpendingEntry`
- Policy: `MealPolicy`, `PolicyRule`, `PolicyEvaluation`, `PolicyExceptionRequest`, `Approval`, `AuditLog`
- AI and CRM: `AIInteraction`, `AIUsageRecord`, `ExternalCRMConnection`, `ExternalRecordMapping`
- Delivery: `Notification`, `NotificationDelivery`, `SecureLinkToken`

Statuses are strings with application checks rather than database enums, so a new status does not require a migration.

## Tokens and money

`SecureLinkToken.tokenHash` is SHA-256 and is unique. `tokenCiphertext` is AES-256-GCM so a representative can copy the link again. The raw token is not stored.

Spending and order amounts are cents. `kind` is `recorded` or `commitment`.

Latitude and longitude are optional floats with an index on `(organizationId, latitude, longitude)`. This build does not enable PostGIS.

## Indexes that matter

- Accounts by organization and name, and by coordinates
- Interactions by account and time, and by representative and time
- Tasks by owner, status, and due date
- Lunch bookings by representative and start, and by status
- Reminders by status and `scheduledFor`
- Spending by account and date
- Notifications by user and read time

## Seed

`prisma/seed.ts` creates roles, the demonstration organization, six fictional offices around north Dallas, visits, tasks, lunches, one open invitation, and one private office link. Completed reminders on past or already-confirmed lunches are marked skipped so opening Today does not replay them. A Riverside reminder is scheduled so the reminder worker has something due.
