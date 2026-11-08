# RepPilot store-readiness audit

Audit date: November 8, 2026 (America/Chicago).
Baseline: main commit `2c55613`, including security PR #1. The fixes accompanying this report have not been deployed to the Grok-hosted app.

**Verdict: NOT READY for App Store or Google Play submission.** The web application has working tested server workflows, but this repository does not yet contain a distributable native app. A successful Next.js build is not an iOS or Android release build. Store approval cannot be guaranteed by this audit.

## Follow-up status

Privacy, support and deletion-intake pages have since been added to main by PR #3. The owner confirmed `Johnson Strategic Outreach and Solutions DBA Rep Pilot LLC`, support at `dathan@abagrowth.com`, and a 30-day verified-deletion-request window. Deadline disclosure and operator due dates are included in the follow-up change. The original evidence below describes the earlier audit baseline; its public-URL failures are historical. Actual deletion fulfillment, backup-retention configuration and native submission work remain open. The verdict remains NOT READY.

## Verified evidence

| Check | Result | Limits |
| --- | --- | --- |
| Six database migrations on a fresh isolated PostgreSQL database | PASS | Not the hosted production database; does not prove upgrade recovery with real data |
| Complete Vitest suite | PASS: 96 tests in 11 files | Includes real database workflow tests and new regression tests |
| Production Next.js build and TypeScript | PASS | Health check reports missing database during build as expected; isolated runtime health check returns 200 |
| ESLint for all src and tests, with zero warnings | PASS | Static analysis only |
| Production dependency audit | PASS: zero reported advisories | Point-in-time registry result; not a penetration test |
| Full dependency audit (including development tools) | 13 affected packages: 11 moderate, 2 low; no high/critical | Development tooling chains include eslint/typescript-eslint, minimatch and shadcn/ts-morph. Registry suggests breaking-version changes; remediate in a separate dependency change rather than forcing a downgrade |
| Role/route HTTP probes | 77 authenticated requests across REP, MANAGER, ORG_ADMIN, COMPLIANCE_ADMIN and PLATFORM_ADMIN | Fixture cookies were sealed directly for route probes. All returned HTTP 200 with no detected 500 marker; streaming may deliver intentional access-denial content inside HTTP 200. Does not establish visual correctness or every permission boundary |
| Real login submission using the rendered server form | PASS: 303 to /today and session cookie issued | Fictional representative, local production server; mobile persistence/relaunch not tested |
| Public login, signup and database health URLs | PASS: HTTP 200 | External integrations disabled |
| Public privacy, terms, support and deletion URLs | BLOCKED: redirect to /login; no corresponding pages found | Must create actual accessible resources; a URL stub is insufficient |
| Live URL access from unsigned-in client | BLOCKED: Cursor access gate | Root returns a link to cursor.com/api/apps-gate/authorize, rather than the RepPilot login |
| Headless visual browser testing | NOT RUN | Chromium cannot start with this executor's available Unix-socket permissions; no screenshot, touch, keyboard, or hydration pass claimed |
| Native simulator/device testing | NOT RUN | No native app project or signed binaries exist in this repository |

Detailed local HTTP results: [http-audit-2026-11-08.json](http-audit-2026-11-08.json). All database records used by this audit were fictional and isolated from hosted databases. No external email, Maps, Gemini or calendar credentials were configured for the audit.

## Fixes included in this audit

- Check-in drafts restore all saved form fields, including participants, next steps, dates, questions and resources. Previously only summary and type were restored. Draft writes wait for recovery, preventing initial empty state from overwriting a saved draft.
- Draft keys include organization and user identity. Legacy practice-only drafts are removed when visiting that practice. Storage failures no longer break check-in saving. Local drafts are still browser storage, not encrypted or server-synced; production retention and shared-device cleanup require a product decision.
- Check-in save failures now show a retry message and clear the saving state. Speech startup errors fall back to typing.
- Another author's check-in edit page is blocked as well as its server mutation, aligning the form with the existing ownership rule.
- Invitation, reminder and meeting-confirmation HTML escapes user-supplied text; plain-text content remains unchanged.
- Gemini requests time out after ten seconds so the deterministic fallback can run when the provider stalls.
- New regression coverage checks complete draft round-trips, invalid stored data, separation between users/organizations, and HTML escaping across email variants.

## Submission blockers and required acceptance evidence

| Priority | Area | Finding and work required | Acceptance evidence |
| --- | --- | --- | --- |
| P0 | Native delivery | Next.js server app plus a PWA manifest only. No Expo/React Native/Capacitor configuration, ios/android projects, native permission strings, bundle IDs, signing, or AAB/IPA artifacts | Decide mobile architecture; produce signed iOS and Android builds with real useful mobile behavior. A thin website wrapper risks Apple's minimum-functionality rejection |
| P0 | Reviewer access | Grok-hosted link currently gates unsigned-in clients through Cursor | Dedicated HTTPS environment reachable without Cursor login; stable fictional reviewer accounts, instructions, backend and integrations available throughout review |
| P0 | Privacy | No privacy page or in-app privacy link; no complete retention/support disclosures | Confirm RepPilot legal operator and support/privacy email; publish accurate public policy and link it in app and store consoles |
| P0 | Account deletion | Signup exists, deletion does not | Findable in-app deletion initiation and a public web deletion resource. Actually delete associated personal data except disclosed legitimate retention; test reauthentication, shared-organization handling, calendar revocation and third-party cleanup |
| P0 | Native permissions | Web geolocation and browser SpeechRecognition are not native permission implementations | iOS/Android location and microphone purpose disclosures; denial/revocation tests; manual entry remains functional. Receipt upload via system picker; no unnecessary broad media permission |
| P0 | Device reliability | No simulator or physical-device acceptance results | Test iPhone/Android small and large screens, safe areas, keyboard, scrolling, app background/relaunch, slow/lost connection, file picking, speech fallback, map gestures and accessible labels |
| P0 | Production security rollout | Source security changes are merged, but hosted commit/secrets/migration state are unverified | Confirm deployed commit; rotate SESSION_PASSWORD; verify HttpOnly cookies and normal cookie forwarding; apply delivery-body redaction after old senders stop; run ownership/cross-tenant checks against staging |
| P0 | Privacy declarations | No Apple App Privacy / Google Data safety / SDK inventory submission evidence | Inventory account details, business contacts, notes, location, receipts, calendar tokens, AI and error telemetry. Complete forms from actual collection/sharing, not feature intent |
| P1 | AI data sharing | Gemini can receive briefing text and conversation openers when configured; no explicit user-consent control found | Disclose third-party AI sharing and obtain required permission before sending personal data. Verify opt-out and provider-disabled fallback. Browser speech services may also process audio externally |
| P1 | Integrations | Salesforce and HubSpot are placeholders without OAuth/live referral queries. Calendar OAuth has code but real-provider consent/sync not tested | Implement and verify any integration advertised at launch, or remove its launch claim. Verify calendar connect, refresh, busy check, event creation, disconnect and return-to-app on devices |
| P1 | Email and scheduling | Local tests use metadata-only demo email; hosted cron depends on scheduler configuration, not merely checked-in vercel.json | Real test inbox confirms invitation/reminder/confirmation flow. Verify cron on the actual Grok host, retries and no duplicate bookings/sends. Never mark logged_demo as delivered |
| P1 | Billing | No Stripe checkout, webhook or entitlement enforcement | Choose free launch or implement an applicable store-compliant B2B subscription model; review Apple/Google payment rules for actual target regions and distribution. Do not advertise working payments |
| P1 | Account recovery | No forgot-password/reset or email-verification flow found | Implement recovery with expiring single-use tokens and enumeration-resistant responses; verify account ownership and email delivery |
| P1 | Mobile API/session design | Browser server actions and cookies are not a native API contract | If using React Native, implement versioned authenticated endpoints and secure native session storage. For a hybrid approach, test cookies, OAuth external browser returns, deep links and lifecycle carefully |
| P1 | Monitoring and operations | Hosted monitoring, backup recovery, uptime, provider keys and secret rotation unverified | Check actual configured environment without exposing secrets; exercise restore into isolated DB, health alerts and rollback |
| P1 | User content | Internal notes and AI-generated text are user content; current anti-PHI checks are keyword heuristics | Confirm applicable reporting/moderation obligations, disclose limitations, and provide support/reporting appropriate to the app. Do not claim PHI screening or HIPAA certification |
| P1 | Store assets | No verified store screenshots, feature graphic, support listing, reviewer notes, age-rating answers or export-compliance responses | Prepare accurate assets from the real signed builds and confirm developer-account identity for RepPilot (Culture Care account status does not establish RepPilot configuration) |

Terms of service are also absent; finalize the appropriate terms with the product's legal operator rather than publishing placeholder legal text. Password recovery is an operational readiness finding, not a claim of a universal stand-alone store rule.

## Required end-to-end matrix

Each row needs a recorded device/browser result and evidence against the release candidate. Server tests alone do not close these rows.

| Workflow | Existing server evidence | Still required |
| --- | --- | --- |
| Signup, login, logout, password change | Local representative login and authenticated rendering; session configuration tests | Signup and role sign-in browser/device checks, persistence after relaunch, logout/session revocation, recovery, deletion |
| Practices and contacts | Practice list/detail/new/edit routes render; assignment scopes covered by tests | Create/edit/import, validation, duplicate handling, cross-role edit denial and persistence on devices |
| Check-in and drafts | Database save creates interaction/tasks and updates last visit; draft regression tests | Full touch flow, reload restores every field, sign-out/account switch, storage-denied handling, rejected save/network retry, speech permission denial |
| Territory and routes | Map/route server pages render; marker/distance/Google adapter unit tests | Actual tiles/pins/filter selection, denial fallback, Google key restrictions, travel time, external navigation and return-to-app |
| Visit briefs and monthly themes | Verified-vs-unavailable referral logic, source evidence and theme permissions tested | Manager publishes/updates/expires theme; rep sees relevant theme and saved brief; configured model failure and consent behavior |
| Meetings and lunches | DB tests cover one-use/expired links, approval and overlap behavior | Office guest opens real link, selects slot, rep approves, clinic receives confirmation; timezone, reschedule, cancellation and conflict cases |
| Catering and spending | Entertainment prohibition and approval paths tested | Separate reviewer, failed/denied approval, actual receipt file validation/upload/download, recorded totals, CSV export and cross-tenant denial |
| Calendar | Unconfigured/disconnected behavior implemented | Real Google and Microsoft consent, token refresh, busy/conflict, event creation and revoke/disconnect on devices |
| Alerts and reminders | DB idempotency test; delivery-body retention tests | Real scheduler and email provider, retry/deduplication, notification navigation, background/native push only if advertised |
| Accessibility and resilience | Static lint only | VoiceOver/TalkBack, large text, contrast, focus, keyboard navigation, reduced motion, offline/slow network and crash monitoring |

## Current platform requirements checked

- Apple: account creation requires in-app deletion initiation; privacy policy must be linked in app and store metadata. Reviewers need working account access and backend availability. Minimum functionality requires more than a repackaged website.
- Apple build requirements currently require Xcode 26+ with the iOS 26 SDK or later. Recheck at actual submission.
- Google: account creation requires deletion initiation in app and via an external web resource, with accurate retention disclosures and Data safety declarations.
- Google: new apps/updates currently target Android 16 / API 36 or higher. Recheck before building/submitting.
- Google personal developer accounts created after November 13, 2023 may require 12 continuously opted-in closed testers for 14 days before applying for production access. Verify the actual account type and creation date; do not assume this applies to an organization account.

Authoritative sources checked November 8, 2026:

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- https://developer.apple.com/news/upcoming-requirements/
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/14151465

## Recommended sequence

1. Confirm the legal owner/support identity, intended free/paid launch, and a reviewer-accessible hosting environment.
2. Implement real privacy/support resources, account recovery and deletion, AI-sharing consent, and production security rollout.
3. Choose and build the native mobile client with native permission handling and stable backend authentication. Do not submit only the current PWA URL.
4. Complete integrations included in launch claims, run the matrix on devices, and record TestFlight/Play internal test evidence.
5. Complete store disclosures/assets and required testing, then submit the verified signed release candidate.
