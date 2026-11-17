# RepPilot launch verification — November 17, 2026

## Scope
Native apps are sign-in companions. Web subscriptions remain available; native Checkout and Stripe Portal server actions are blocked. Original 14-day trial and verified paid access are preserved. This does not constitute App Store or Play approval.

Live Salesforce/HubSpot referral queries are unavailable. Google/Microsoft calendar sync and generative AI require configured credentials and end-to-end acceptance before being advertised. Internal calendar, notes, tasks and deterministic conversation preparation remain usable. Do not market these as verified live integrations.

## Framework patch

Next.js and eslint-config-next upgraded from 16.4.3 to 16.4.5 for the November security fixes. Rebuild and full acceptance are required before deployment.

## Operational release
- Independent Render scheduler calls authenticated production reminders every five minutes in production.
- Failed deliveries return HTTP 503 and do not refresh the last-success heartbeat.
- Direct Resend owner alerts avoid recursive email-failure reporting and deduplicate by incident route in 15-minute windows.
- No customer/office recipients may be used in production verification. Use the authorized owner's inbox and marked synthetic records.

## Required evidence still outstanding
- Independent scheduler-failure notification verification. Owner reminder and operational-alert inbox receipt are confirmed below.
- Isolated hosted staging database with no production credentials or customer data.
- Hosted production snapshot restored to a separate branch; record source timestamp and schema/record comparisons. Never restore over production for a drill.
- Physical iPhone and Android: sign in/out, password reset, map gestures, 16-stop route optimize/reorder/save/reopen/navigation, calendar/lunch lifecycle, background/reopen, offline errors, keyboard and safe areas.
- Confirm store-console declarations match companion scope. Native purchase controls and direct server actions were verified by automated acceptance; physical-device acceptance remains outstanding.
- Web billing: authorized card setup preserves original trial end, webhook retry, successful/failed first charge, cancel before trial end, monthly/annual tiers and exports.

A successful build, local database restore or Chromium test alone does not satisfy physical-device or hosted recovery requirements.

## Recorded results

- CI run 44109003749: 332 tests passed; type check and production build passed; 42 pages and 70 internal links passed; 16-office route workflow, native companion billing restrictions, owner MFA and revenue Excel checks passed.
- Framework patched to Next.js 16.4.5.
- Production release 1922f82769036ae5dcb8a6f947c62a21f0ecff76 deployed successfully.
- Render cron `crn-dbu6oso8v5cc73c3g8o0` runs every five minutes. November 17: 15:05 UTC processed 1, failed 0; 15:10 UTC processed 0, failed 0. Database verification found one SENT reminder and exactly one accepted delivery record.
- Dathan explicitly confirmed receipt of BOTH the operational alert and the synthetic office reminder. Resend delivery lookup was unavailable with the current credentials; inbox confirmation is human evidence, not a provider delivery-status assertion.
- Production health: database up, email configured, monitoring configured, external scheduler configured.
- Android debug build succeeded in mobile run 44108130965; iOS simulator job canceled. Neither result is physical-device acceptance.
- Dathan has an iPhone and computer, no Android device. Physical Android acceptance needs another tester or real-device service.
- Connected Neon account still cannot access Vercel-managed RepPilot project `polished-heart-76782091` (`reppilot-test`). Hosted staging and production snapshot recovery remain BLOCKED; unrelated SidelineLoop/Handled projects were not changed.
