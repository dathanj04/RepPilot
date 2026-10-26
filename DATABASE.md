# Database

PostgreSQL is accessed with Prisma 7. The schema is `prisma/schema.prisma`. The client is generated to `src/generated/prisma` and is not committed. `npm install` runs `prisma generate`.

Configuration lives in `prisma7.config.ts` because Prisma 7 reads the connection string from that file, not from the schema `datasource` block.

```bash
npx prisma migrate dev
npm run db:migrate:deploy
npm run db:seed
```

`prisma migrate deploy` reads `DIRECT_URL` when it is set, and otherwise `DATABASE_URL`. Use the Neon **direct** connection string for `DIRECT_URL` and the Neon **pooled** connection string for `DATABASE_URL`. The app runtime uses `DATABASE_URL` only.

Migrations:

- `prisma/migrations/20261013130854_init`
- `prisma/migrations/20261027010000_rate_limit_and_delivery_clock`

## Staging and production databases

Use two Neon branches, or two Neon projects, that do not share a connection string.

| Environment | `APP_ENV` | Database |
| --- | --- | --- |
| Local | `development` | Postgres on the developer machine |
| Staging | `staging` | Neon branch `staging` |
| Production | `production` | Neon branch `production` |

Create the Neon project, then create a branch named `staging` from `production` only when production is still empty. After launch, restore a staging copy from a backup or a fresh branch instead of pointing staging at production.

For each environment:

1. Copy the pooled URL into `DATABASE_URL` and the direct URL into `DIRECT_URL`. Both should include `sslmode=require`.
2. Run `npm run db:migrate:deploy` with those variables. Do not run `npm run db:seed` against staging or production. The seed deletes the demonstration organization and refuses `APP_ENV=production` or any non-local URL unless `ALLOW_DEMO_SEED=true` on a disposable branch.
3. Keep the existing VM database until the hosted database has been migrated and checked. Do not drop it as part of this move.

Neon keeps point-in-time restore for the project. That is the hosted backup. A restore test on Neon is: restore the branch to a new branch from a timestamp in the Neon console, set `DATABASE_URL` to that branch, and run `SELECT count(*) FROM "Organization"`. Drop the restored branch when the counts match. Do not restore over the production branch.

## Local restore drill

`npm run db:restore-drill` dumps the local `DATABASE_URL` database, restores it into `reppilot_restore_drill` on the same server, compares `Organization`, `User`, `Account`, and `_prisma_migrations`, then drops only the drill database. It refuses a remote URL unless `RESTORE_DRILL_ALLOW_REMOTE=true`. It does not dump or drop a Neon production branch.

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

The seed runs only against `localhost` or `127.0.0.1`, and it exits before writing when `APP_ENV` or `VERCEL_ENV` is `production`.
