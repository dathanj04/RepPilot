# Testing

```bash
npm test
npx tsc --noEmit
npx eslint src tests --max-warnings 0
```

`npm test` runs Vitest.

## Domain tests

`src/lib/domain/domain.test.ts` covers marker priority, straight-line distance, policy blocks, spending separation, reminder math, invitation expiry, extraction without invented activities, briefing numbers, and route reasons. `src/lib/maps/provider.test.ts` covers geocode precision, dropped Places addresses, Routes durations, and appointment-gap warnings. These tests do not need Postgres or a Google key.

## Workflow tests

`tests/workflows.test.ts` uses `DATABASE_URL_TEST`. It checks:

- A check-in saved in one organization is invisible to another.
- The account timeline and last-visit date update.
- A follow-up task is created from the check-in.
- Two accepts of the same invitation cannot both book.
- An expired invitation token cannot book.
- A confirmation link does not confirm a canceled lunch.
- A due reminder sends once.
- An entertainment order stays blocked, and the exception is prohibited.

The test database must already have the migrations applied (`npx prisma migrate deploy` with `DATABASE_URL` pointed at the test database, or run migrate against both URLs).

## What is still manual

Browser coverage of login, the map, a saved check-in, a clinic confirmation, and an order record is part of development verification. There is no Playwright suite in this repository yet.

A missing Google Maps browser key is covered by the Leaflet fallback in the map component. A missing server key is covered by the provider returning `not_configured` before any duration or place is shown. Disconnecting Gemini is covered by the deterministic extractor tests. Calendar and CRM disconnects are visible on the Calendar and Admin screens because their rows stay `not_connected`.
