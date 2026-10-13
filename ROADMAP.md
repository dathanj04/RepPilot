# Roadmap

The Basic daily loop is implemented: Today, map, accounts, check-in, history, tasks, lunch invitations, clinic pages, reminders, catering handoff, spending, and reviewable AI drafts.

These items are intentionally not finished.

## Next product work

- Google Routes waypoint optimization, using API durations rather than model guesses.
- Google Places search for nearby offices that are not already accounts.
- Google Calendar and Microsoft Graph OAuth, free/busy, and event create/update/cancel with stored external ids.
- Salesforce and HubSpot sync with field mapping, conflict rules, and a tested OAuth connection.
- Stripe subscriptions and plan entitlements. Prices in the product today are labels only.
- Durable rate limiting and a dedicated worker for reminders, instead of in-memory limits plus the Today-page sweep.
- Receipt file upload with type checks and private storage.
- Playwright coverage of the mobile check-in and clinic confirmation.
- PostGIS, or an equivalent index, if territory search outgrows the coordinate index.
- A documented HIPAA assessment and agreements before anyone treats the app as a covered-entity system. The product must not claim that certification from this codebase alone.

## Packaging

Basic, Pro, and Enterprise remain proposed packages. Compliance blocks, tenant isolation, and audit logging are not paid upgrades. Pro and Enterprise screens that exist (team coverage, policy review, reports, platform list) read the same records and do not unlock a bypass.
