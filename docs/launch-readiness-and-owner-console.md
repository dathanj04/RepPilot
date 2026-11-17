# RepPilot owner console and release audit
Review date: November 16, 2026 (America/Chicago).

## Owner access
The private console is /platform. Every page checks the server-side PLATFORM_ADMIN membership. A forged role in a browser cookie cannot grant access. Demo/reviewer platform accounts are explicitly blocked from owner controls. Login prioritizes an existing platform membership.
The operator must confirm the intended existing account email before provisioning. Do not infer that identity from a support address. Run scripts/provision-platform-owner.ts with CONFIRMED_PLATFORM_OWNER_EMAIL and --confirm-owner only after verifying the owner. This attaches a separate platform membership, preserves existing customer memberships and never changes the password. It was not run during this audit.
No shared/default administrator password is introduced. Platform accounts cannot be disabled, demoted, paused or erased through these controls.

## Console capabilities
Overview and searchable, paginated workspaces; user search and enable/disable sign-in; workspace pause/resume; organization-role management with last-administrator protection; live Stripe subscription verification and links to Stripe customer management; connection configuration, scheduler heartbeat and overdue reminders; failed-delivery inspection and cancellation-notice retries; owner audit history and account-deletion queue.
Changes require the operator's current password, confirmation and a reason. Database changes and audit entries commit together. Disabling a user increments a session version, so existing cookies stay revoked even after re-enabling. Access checks immediately block already-signed-in disabled users and paused workspaces, including public clinic links. Pausing access does not cancel or refund Stripe billing.
Retries reconstruct the original cancellation from its immutable audit details and retain the delivery idempotency key. No real cancellation email is sent during testing.

## Verified production observations
The production /api/health response reports the database up, email configured and monitoring not configured. Environment-variable names confirm Stripe, email and TomTom are configured. Google Calendar and Microsoft OAuth credentials, GEMINI_API_KEY and monitoring credentials are absent. CRM referral synchronization currently returns an explicit not-connected result; do not advertise live CRM imports as completed.
Credential presence is not a successful provider test. The app's configured cron interval is every 15 minutes; scheduler execution must be proven by fresh heartbeats. Earlier Git deployment attempts were rejected for the account's cron limits; choose a supported scheduler/hosting plan before relying on timed reminders. This change does not purchase a hosting upgrade.

## Launch recommendation
Controlled beta, not unrestricted paid general availability yet.
1. Prove reminder delivery and cancellation suppression on the actual scheduler; check heartbeat and overdue queue.
2. Connect and test external-calendar OAuth, permission scopes, busy-time conflict checks and booking writes using dedicated test accounts if calendar integration is promised.
3. Configure monitoring/alerts and complete a backup restoration drill. Separate Preview/staging from the production database before conducting purchase or data tests there.
4. Complete the intended CRM provider adapters and referral sync; connect the chosen generative AI provider before claiming those capabilities. Current deterministic conversation preparation remains usable.
5. Add owner MFA and tested password/account recovery, and verify store purchase-channel setup for the intended iOS/Android storefronts before public distribution.
6. Perform real-device iOS and Android testing for keyboard/safe areas, GPS permissions, drag reorder, app switching, navigation launch and poor connectivity. Chromium mobile emulation cannot certify those native behaviors.

## Audit scope
Automated disposable-PostgreSQL tests exercise billing entitlement, 14-day trials, routes, check-ins, lunch workflows, cancellation, role isolation, administrative mutation authorization, disabled-session rejection, pause/resume persistence and audit records. Browser validation crawls core customer screens, dynamic account/lunch pages and their rendered internal links, plus owner pages and valid public clinic links. External destinations are inventoried but external websites, OAuth consent and payment-provider user interfaces require their own live-provider checks.
The GitHub Actions app-browser-audit artifact contains the link inventory and fixture-only screenshots. No production customers, lunches, subscriptions or office emails are mutated by the audit.

## Security and operations follow-up
Owner-console access now requires authenticator enrollment and a fresh MFA check every 30 minutes, in addition to the existing database role and password checks. Authenticator secrets are AES-GCM encrypted. One-time recovery codes are hashed; enrollment revokes old sessions. Password-reset links expire after 30 minutes, are hashed and single-use, and revoke prior sign-ins without removing MFA. Account erasure also removes MFA and reset records. Owner provisioning still requires confirmation of the intended login email.

Unhandled incidents are grouped in the owner Operations page using route patterns and counts. Raw exception text, stack traces and request URLs are excluded from monitoring output. External incident notification is still unconfigured and must be tested after a destination is selected.

All 20 shared production credential entries were restricted to production. Future previews require independent credentials and should fail closed until an isolated staging database is provisioned. Existing deployments retain their original environment snapshots; this does not certify those previews as staging. Existing Vercel Authentication protects non-custom-domain deployments. No staging database or provider recovery branch has been created by this change.

The restore drill now uses a unique disposable local database, exports a consistent source snapshot, restores it and compares contents of every public table, then removes the temporary dump and database. It refuses remote targets even if a legacy override is set. The CI drill validates the recovery process for synthetic data; it is not evidence of a successful production Neon point-in-time recovery or of a configured retention policy.

The OpenAI Responses transport is wired into visit-openers and daily-briefing polish. OPENAI_API_KEY is required; OPENAI_MODEL defaults to the previously requested gpt-5-nano. AI_PROVIDER may explicitly select openai or gemini. Requests use store:false, bounded input/output and a timeout. Partial, refused, malformed and failed responses use deterministic fallback. Existing fact validation remains in place and check-in extraction remains local. No live OpenAI request has passed yet. Official model documentation announces gpt-5-nano retirement on December 11, 2026; select and validate its successor before that date rather than silently changing the requested model.

Reminder jobs now require an explicit sent provider result. Demo/missing/failed results are not recorded as successful sends. Vercel runtime tooling confirms this project is on Hobby; the existing 15-minute schedule is not a verified supported production scheduler. No hosting-plan purchase or scheduler upgrade was made. Live delivery/heartbeat evidence remains required.

Real-device iOS/Android behavior, App Store/Play billing, Google/Microsoft OAuth, and live CRM referral adapters remain launch gates. Automated browser fixtures cannot certify those connections.
