# Product roadmap

RepPilot is one application. Later phases extend it. They do not replace the working field loop.

Prices in the master plan ($39, $79, $599, custom enterprise) are provisional assumptions. Stripe is not connected, and the app does not charge a card.

## Phase 1 — Foundations

Implemented and covered by the current test suite.

- Email and password sign-in, organization signup, and iron-session cookies.
- Tenant-scoped organizations with `REP`, `MANAGER`, `COMPLIANCE_ADMIN`, `ORG_ADMIN`, and `PLATFORM_ADMIN`.
- Rep dashboard at `/today`.
- Account create, edit, search, contacts, notes, and duplicate blocking on name plus street plus ZIP inside one organization.
- Audit rows for account create and update, profile changes, check-ins, lunches, and catering decisions.
- Desktop navigation for the completed screens: Dashboard, My Territory, Accounts, Route Planner, Calendar, Lunch & Learns, Activities, Reports, and Settings. Team and Organization appear only for roles that can open them.
- Mobile navigation stays Map, Accounts, Today, Calendar, and More so the bar remains usable.

Not in this phase: OAuth login, multifactor authentication, medical-office staff accounts, and data export. Those stay later so the current sessions and records are not replaced.

## Phase 2 — Google Maps and territories

Implemented behind the Google key, with an honest empty state when the key is absent.

- Territory map with visit-colored pins, city, ZIP, territory, owner, and status filters, and a selected-office card.
- Google Maps JavaScript when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set. Otherwise Leaflet and OpenStreetMap.
- Places text search that adds an office only after the representative confirms a specialty. Incomplete Google addresses are discarded.
- Geocoding on save when coordinates are blank. Approximate matches are not stored.
- Route planner: record-based suggestions, manual order, straight-line reorder (labeled as straight-line), Google Routes drive time only when the API returns it, appointment-gap warnings, and a Google Maps handoff for the saved order.
- Audit rows and per-user rate limits for the server map calls. Responses are not cached as licensed place content.

Still later: traffic-aware reordering, drawing a territory polygon on the map, and storing a drive time on the saved route row. The saved route keeps the stop order and tells the reader to check drive time again.

## Phase 3 — Calendar and approval-gated invitations

Implemented for RepPilot scheduling invitations.

- A representative issues a single-use link with a 24-hour default lifetime, or 48 hours or 7 days when the organization allows it.
- The office can request one offered time. The request stays `PENDING`. No confirmed meeting and no external calendar event are created.
- The representative approves, declines, or proposes another offered time. Approval checks RepPilot commitments again, and a connected Google or Microsoft calendar when one exists. A failed calendar read leaves the request pending.
- Confirmation writes one RepPilot meeting. A second approval does not create another. An external event is written only after a connected calendar accepts it, and a failed write is labeled `failed` rather than synced.
- An expired or used link cannot create a booking. The expired page uses the required expiration message and can ask the representative for a new invitation without booking anything.
- A request that was already submitted stays on its own record after the link expires.
- Lunch slot selection now waits in `AWAITING_APPROVAL` with a tentative hold. Reminders start after the representative approves.
- Google and Microsoft OAuth start, callback, disconnect, and free/busy adapters are in place. They stay disconnected until client credentials exist and a user completes authorization.

Still later: Apple Calendar beyond the internal record, two-way iCloud, and webhook reconciliation for external event edits.

## Phase 4 — Lunch and learn coordination

Implemented for the catering handoff. Live menus and automatic checkout stay disconnected.

- An office can request a time and sponsored catering together. The lunch stays off the calendar until the representative approves it.
- Catering has its own approval. The representative who owns the lunch cannot approve it. A manager, compliance administrator, or organization administrator does.
- Provider links for ezCater and DoorDash stay closed until both approvals exist. Opening a link does not place, pay for, or complete an order.
- The representative records the provider reference, the amounts from the receipt, and an optional PDF or image. Line items are stored only when they add up to the total. RepPilot does not calculate tax, tip, or a menu price.
- Receipt files and the meeting and catering decisions stay on the lunch. Delivery status is whatever the representative records.
- Reminders cover seven days, 48 hours, 24 hours, the delivery day, and a separate note to the representative when the office has not confirmed. A missing confirmation does not cancel the lunch.

Still later: a licensed catering catalog, live delivery tracking, and payment inside RepPilot. Those need a real partner agreement. Uber Eats stays not connected.

## Phase 5 — CRM

Partial. Salesforce and HubSpot connection rows stay `not_connected`. There is no OAuth and no live referral query. An administrator can save an approved or ambiguous practice mapping. A sync attempt records unavailable, ambiguous, or failed and does not write a referral count. A verified count appears only when a snapshot was stored by a successful query, which this build does not perform.

## Phase 6 — AI assistant

Partial. Check-in extraction, the daily briefing, and the pre-visit conversation all have a deterministic path. Gemini rewrites an opener only when `GEMINI_API_KEY` is set and the rewrite keeps the same numbers. There is no general chat assistant and no automatic CRM write. Visit notes are treated as data, not instructions.

## Visit intelligence and monthly themes

Implemented on the existing account, check-in, and team screens.

- A practice profile and the check-in screen show a pre-visit brief: last conversation, open follow-ups, a CRM freshness line, talking points the representative can edit, an opener, and one next action.
- Missing, failed, stale, or ambiguous CRM data is labeled unverified. It is not shown as zero referrals.
- Saving a check-in stores who was met, questions, challenges, resources, and whether the representative marked the monthly theme as discussed. Selected next steps are the only new tasks.
- Managers and organization admins create, publish, and archive monthly themes. A published theme shows on a representative’s Today page when the dates, team, and territory match. A practice brief uses it only when the specialty and territory also match, and an open follow-up stays ahead of the theme.
- The theme report separates representative-reported visits from verified CRM snapshots and does not attribute referrals to the theme.

## Phase 7 — Enterprise and billing

Partial. Team coverage, territories, people, organization settings, and reports read the signed-in organization only. Stripe checkout, seats, and the billing portal are not implemented.

## Explicitly out of scope until a later approved phase

- Native iOS and Android apps. The server actions and Prisma services are the API surface a future Expo client can call.
- Patient information. Notes that contain patient, diagnosis, or MRN are rejected.
- HIPAA, SOC 2, or any other certification claim.
- Catering partner accounts.
- SMS.
