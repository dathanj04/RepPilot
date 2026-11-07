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

Partial. Lunch invitations expire, accept one slot, and reject a second booking. Clinics do not receive a standing calendar. Google Calendar and Microsoft Graph OAuth, free/busy, and a separate meeting-request state machine are not built. A clinic cannot confirm a representative's external calendar because no external calendar is written.

## Phase 4 — Lunch and learn coordination

Partial. Requests, attendance, budget, policy blocks, catering handoff to ezCater and DoorDash, reminders, and order notes exist. Receipt files, live menus, and automatic checkout do not. Opening a provider site does not place or pay for an order.

## Phase 5 — CRM

Not connected. Salesforce and HubSpot connection rows stay `not_connected`. There is no OAuth, import, or writeback.

## Phase 6 — AI assistant

Partial. Check-in extraction and briefings run on Gemini when `GEMINI_API_KEY` is set, and on a deterministic parser otherwise. The parser does not invent activities. There is no general chat assistant and no automatic CRM write.

## Phase 7 — Enterprise and billing

Partial. Team coverage, territories, people, organization settings, and reports read the signed-in organization only. Stripe checkout, seats, and the billing portal are not implemented.

## Explicitly out of scope until a later approved phase

- Native iOS and Android apps. The server actions and Prisma services are the API surface a future Expo client can call.
- Patient information. Notes that contain patient, diagnosis, or MRN are rejected.
- HIPAA, SOC 2, or any other certification claim.
- Catering partner accounts.
- SMS.
