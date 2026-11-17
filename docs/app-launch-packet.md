# RepPilot app launch packet

Prepared November 17, 2026. Status: PREPARED, NOT CLEARED FOR PUBLIC RELEASE.

## Release scope

Prepare iOS first using the existing TestFlight app. Android stays in testing until a physical Android tester or device service provides evidence. Dathan has an iPhone and computer. This sequencing is a preparation recommendation, not authorization to submit or release either store app.

The native apps remain sign-in companions, as confirmed by the owner. Individual and Business plans are visible; card setup and subscription changes remain on the web. Preserve existing 14-day trials. Do not add native payment links or purchase controls during submission preparation.

Store copy: [listing](../workspace/mobile/STORE_LISTING.md). Operational evidence: [verification](launch-verification-2026-11-17.md).

## Verified baseline

- Production health returned HTTP 200, database up, email/monitoring configured, external scheduler configured on November 17.
- Latest functional CI: https://github.com/dathanj04/RepPilot/actions/runs/44122809670 — passed, including 332 tests and browser acceptance.
- Automated acceptance covers 16-stop creation/optimization/reorder/save/reopen, route markers, road polyline, navigation link, scrolling, billing tiers, native payment restrictions, owner security, Excel revenue export and lunch cancellation.
- Scheduled reminder and owner alert received by the owner. One reminder delivery record; subsequent scheduled runs did not resend it.
- Framework patch: Next.js 16.4.5.

## Physical acceptance — record results, never assume PASS

Use a fictional test workspace. Never email a real office or charge a customer's card during checks.

| Check | Expected result | iPhone result | Android result |
| --- | --- | --- | --- |
| Sign in, sign out, reset password | Correct account; private recovery response | NOT RUN | NOT RUN |
| Map pan, zoom, recenter | Smooth gestures; controls do not overlap | NOT RUN | NOT RUN |
| Create 16-stop route and optimize | Road route and numbered stops | NOT RUN | NOT RUN |
| Reorder, change duration, save | Timing/order retained | NOT RUN | NOT RUN |
| Force-close and reopen | Saved route survives | NOT RUN | NOT RUN |
| Go | Navigation opens correct first destination | NOT RUN | NOT RUN |
| More/settings, keyboard, safe areas | Vertical scrolling; fields/buttons reachable | NOT RUN | NOT RUN |
| Lunch creation/cancellation | Status persists; authorized test inbox only | NOT RUN | NOT RUN |
| Internal calendar | Correct dates/timezone and event details | NOT RUN | NOT RUN |
| Subscription page | Both tiers, trial details; no native purchase actions | NOT RUN | NOT RUN |
| Offline/background/reconnect | Useful error/recovery; saved records remain | NOT RUN | NOT RUN |
| Support/account deletion | Reachable; deletion only with intentional confirmation | NOT RUN | NOT RUN |

Record device model, OS version, app version/build, date, tester, and screenshots for each failure. A screenshot from Chromium is not physical-device evidence.

## Screenshot capture plan

Capture the actual signed candidate with fictional records, no patient data, no owner email or private tokens. Use the device sizes requested by each store console. Capture iPad screens if iPad support remains enabled.

| Order | Screen | Caption |
| --- | --- | --- |
| 1 | Map with saved accounts | Your territory, in view |
| 2 | Numbered route and blue road line | Plan a smarter day |
| 3 | Current route stop list | Make the route your own |
| 4 | Account visit history and tasks | Keep every follow-up moving |
| 5 | Lunch & Learn coordination | Bring office outreach together |
| 6 | Subscription tier comparison | Tools for the way you work |

Do not fabricate store screenshots or use generated pictures as evidence of app behavior.

## App Review notes — paste after review access is verified

RepPilot is a business outreach and route-planning workspace. The mobile app is a companion to existing workspaces. It does not accept card entry or initiate subscription purchases. The subscription screen compares plans and displays workspace/trial information. The app does not purchase catering.

Use the dedicated account supplied in the private review-access fields. All records in that workspace must be fictional. After signing in: open Map, select an account and add it to a route; open Routes to reorder and save stops; reopen the saved route; open Accounts to record a visit; open Lunch & Learns and Calendar to inspect coordination; open Settings for support and account deletion.

Before pasting: validate these exact steps against the supplied account, verify all required entitlements and ensure its access remains active throughout review. Do not put a placeholder password or the owner's login in the store.

## Blocking gates

1. **Database access:** Neon project `polished-heart-76782091`, store `reppilot-test`, is in Vercel's Culture Care team. Connected Neon account still returns project-not-found. Open Vercel → RepPilot → Storage → reppilot-test → Open in Neon and connect that owning account/org. No unrelated database should be changed.
2. **Recovery/staging:** create isolated hosted staging without production records/secrets; restore a hosted production snapshot into a separate branch and compare consistent schema/data. CI's local 56-table restore is not this proof.
3. **Independent outage alert:** verify scheduler-failure notification delivery independently of RepPilot/Resend. Existing owner alert receipt does not prove the same email provider can report its own outage.
4. **Real-device results:** complete the table above. Android requires another tester/service.
5. **Reviewer access:** provision and verify a dedicated fictional workspace account with access lasting through review, without granting owner privileges or making an unsafe general entitlement bypass.
6. **Console checks:** finalize privacy/data safety, age rating, encryption answers, availability, rights, support/contact details and review login against the shipped build. Do not infer answers from the category alone.
7. **Billing:** confirm web trial/card/cancel/first-payment lifecycle with approved test evidence; no unauthorized real charge. Confirm native companion declarations and no purchase path through support/admin navigation.
8. **Signed candidate:** attach the intended App Store build and produce a signed Android release for its testing track. Current local environment lacks Xcode and Android SDK; previous cloud/debug results are not store-release signing evidence. The Codemagic workflow does not automatically submit for public review.

## Release execution, after gates pass

- Confirm production commit, build numbers and screenshots match the tested candidate; record evidence links.
- Set manual release/managed publishing in the respective console and verify the setting.
- Submit the prepared candidate for review only after explicit owner instruction. Store acceptance is not guaranteed, including minimum-functionality review of the remote web wrapper.
- After approval, release to a small initial cohort and monitor sign-in, errors, scheduler heartbeat, email failures and paid access before broader promotion.
- Keep the last known-good Vercel deployment and signed build identifiers. A server rollback does not reverse database migrations, billing events or sent messages; assess those separately before rollback.

## Policy references checked

Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
Google Play Payments: https://support.google.com/googleplay/android-developer/answer/10281818
