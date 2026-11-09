# Privacy, support and deletion rollout

Operator identity supplied by the owner:
- `Johnson Strategic Outreach and Solutions DBA Rep Pilot LLC`
- `dathan@abagrowth.com`

The owner confirmed the spelling correction to "Solutions" and a 30-day deletion-processing window. The rest of the supplied legal-name structure is preserved. No legal approval is implied.

## Implemented

- Public, unauthenticated `/privacy`, `/support`, and `/delete-account` pages, linked from login, signup and Settings.
- Protected `/delete-account/confirm` form reachable from Settings and a web browser without reinstalling an app. Identity is derived from the server session; submitted user IDs/emails are ignored.
- Current-password verification and explicit confirmation. A successful confirmation erases sign-in, profile, calendar credentials, notifications, and AI records, then signs the person out. Organization visit, meeting, and spending records remain under the name Deleted user.
- Shared database rate limiting, unique per-user idempotency, and no password or extra email copy in the queue.
- Platform-admin-only `/platform/deletion-requests`, linked from `/platform`. The assigned operator is dathan@abagrowth.com. The queue can retry a pending request or erase an account that was requested by email after ownership is confirmed.
- Migration adds AccountDeletionRequest. Completing a request does not delete the organization or other members.

## Release blockers that remain

1. dathan@abagrowth.com still clears backup copies and provider-held mail or calendar data within 30 days. The app does not call those providers’ deletion APIs.
2. Establish the exact backup-retention schedule and tell the person when a copy will age out.
3. Publish a reviewer-accessible host, rotate the session secret, and apply migrations on that database.
4. Native store binaries still need the account owner’s signing keys and a physical-device pass. A privacy page does not implement consent before sending text to a third-party AI provider.

## Handling a pending request

1. Review the platform queue in a secure operator session. Inspect only the account and personal records needed for that request.
2. Confirm scope, requested identity and ownership of shared records. The signed-in form has already checked the current password; do not demand a separate support call/email just to initiate deletion.
3. Process the verified request within 30 days and tell the person any justified retained categories/periods. Review any external subscription cancellation requirements without unnecessarily blocking deletion.
4. Map all personal data and user content, direct and indirect foreign-key references, receipts, calendars, AI records, audit metadata, email delivery metadata, rate-limit keys, local drafts, provider copies and backups. Never blindly run User.delete: cascade rules and shared content can delete another user's records or leave personal information behind.
5. Process deletion/anonymization only under the confirmed policy and retention schedule, revoke applicable provider credentials, remove pending operational messages, and validate that old sessions cannot authenticate.
6. Confirm completion to the person through the verified channel. Record the evidence and only then set the request status/completion time. Do not mark completed merely because an account is disabled, a password changed or an email sent.
7. Keep the minimum request evidence justified by the approved retention policy and remove it when that period expires. This queue intentionally does not copy email addresses or passwords.

## Acceptance checks

- All three public URLs load without a session or configured session secret.
- Confirmation URL redirects unauthenticated visitors to login.
- Valid user can submit from the app; wrong password or an unchecked confirmation does not erase the account. An extra userId field cannot target a different account.
- Repeating a completed deletion does not create a second request.
- A completed deletion removes sign-in, profile, calendar credentials, notifications, and AI records. Organization visit records remain. Other members stay.
- Only platform admins see the processing queue; ordinary users cannot read other requests.
- Recheck privacy statements against deployed integrations; retained historical delivery bodies require the prior redaction migration.
- Actual deletion and confirmation remain an explicit untested release blocker until a fulfillment implementation exists.

## Verification (November 8, 2026)

Against an isolated PostgreSQL instance using fictional accounts:
- Seven migrations applied successfully.
- 87 tests across 10 test files passed on this branch, including correct-password, explicit-confirmation, duplicate-request and rate-limit checks. This branch is based on main and does not include the separate audit PR #2 changes/tests.
- Next.js production build, TypeScript and ESLint completed successfully.
- 88 local production-server HTTP probes completed without detected 500 markers. Public privacy/support/deletion pages returned 200; the protected confirmation page redirected unsigned-in requests to login.
- A real password-confirmed form submission returned 303 and created a PENDING row for the authenticated representative. An extra forged userId field was ignored; no request was created for the other account.
- Login still returned 303 to /today and issued a session cookie.

These are local server/HTTP checks, not native-device or visual browser testing. No production data was erased, external email sent, hosting changed, or actual account-deletion fulfillment verified.
