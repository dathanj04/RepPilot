# Architecture

RepPilot is one Next.js application. The browser talks to React Server Components and server actions. PostgreSQL, through Prisma 7 and the `pg` driver adapter, is the system of record.

## Request path

- `src/proxy.ts` requires a session cookie except for `/login`, `/signup`, clinic links (`/i`, `/l`, `/o`), and `/api/cron`.
- Sessions use `iron-session`. The sealed cookie stores `userId`, `organizationId`, and `roleKey`.
- `requireAppUser` loads the membership and refuses the platform administrator. `requirePlatformAdmin` does the reverse.
- Operational queries filter on `organizationId`. Public clinic pages resolve a hashed token and load only that invitation, lunch, or office.

## Domain logic

Pure functions in `src/lib/domain` decide marker tone, straight-line distance, meal-policy results, spending totals, reminder instants, invitation acceptance, check-in extraction, and the daily briefing. Services in `src/lib/services` persist those decisions. Tests cover the pure functions without a database, and `tests/workflows.test.ts` covers persistence.

## Check-in

The form keeps a local draft so a refresh does not wipe an unsaved note. Save goes through `saveCheckIn`. A physical completed visit updates `lastVisitAt`. Follow-up tasks are created only from the steps the rep keeps. Dictation calls `extractCheckIn`, which validates a Zod schema. The draft is not saved until the rep presses Save Check-In.

## Lunches

A representative creates an invitation with explicit slots. The clinic page can select only those slots. Acceptance locks the invitation row, checks overlap on the representative, creates one booking, schedules three reminders, and revokes the invitation token. A second accept fails.

Reminders:

- Seven days before, at the same local clock time.
- Forty-eight hours before, exact.
- Twenty-four hours before, the representative is notified if the office has not confirmed. The lunch is not canceled.

`processDueReminders` claims a row by moving `SCHEDULED` to `SENDING`, so a second worker does not send it again. The Today screen runs due reminders so a local demo does not need a scheduler. Production should also call `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`.

## Money and policy

Amounts are integer cents. `summarizeSpending` drops a commitment when the same booking already has a recorded row. Year-to-date uses the UTC year.

Meal review uses the organization's active policy. Entertainment and referral-linked meals are blocked and cannot be approved. A missing policy blocks order recording. An internal per-person cap can be excepted only when the policy allows exceptions and a reviewer approves. The cap is a company figure. The screen says it is not a federal meal allowance.

## Maps, AI, email, calendars

Each integration is an adapter:

- Maps: Google Maps JavaScript when the public key exists, otherwise Leaflet and a Carto basemap.
- AI: Gemini on the server when `GEMINI_API_KEY` exists, otherwise the deterministic extractor. Briefings that contain numbers outside the calculated set are discarded.
- Email: Resend when configured, otherwise a `logged_demo` delivery row.
- Calendar and CRM: connection rows stay `not_connected`. Internal `CalendarEventMapping` rows are created for accepted lunches.

## Roles

`REP`, `MANAGER`, `COMPLIANCE_ADMIN`, and `ORG_ADMIN` belong to a customer organization. `PLATFORM_ADMIN` belongs to a separate platform organization and cannot open the rep application. Managers see team coverage. Compliance administrators review exceptions. Organization administrators change settings, people, and territories.

## Mobile and desktop

The same records render in both layouts. Mobile uses a bottom bar: Map, Accounts, Today, Calendar, More. Desktop uses a left sidebar.
