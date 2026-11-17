# RepPilot launch verification — November 17, 2026

## Scope
Native apps are sign-in companions. Web subscriptions remain available; native Checkout and Stripe Portal server actions are blocked. Original 14-day trial and verified paid access are preserved. This does not constitute App Store or Play approval.

Live Salesforce/HubSpot referral queries are unavailable. Google/Microsoft calendar sync and generative AI require configured credentials and end-to-end acceptance before being advertised. Internal calendar, notes, tasks and deterministic conversation preparation remain usable. Do not market these as verified live integrations.

## Operational release
- Independent Render scheduler calls authenticated production reminders every five minutes, once provisioned and deployed.
- Failed deliveries return HTTP 503 and do not refresh the last-success heartbeat.
- Direct Resend owner alerts avoid recursive email-failure reporting and deduplicate by incident route in 15-minute windows.
- No customer/office recipients may be used in production verification. Use the authorized owner's inbox and marked synthetic records.

## Required evidence still outstanding
- Two natural scheduled runs, exactly one due-reminder delivery, provider delivery confirmation, retry and duplicate suppression.
- External alert delivery receipt and scheduler-failure notification.
- Isolated hosted staging database with no production credentials or customer data.
- Hosted production snapshot restored to a separate branch; record source timestamp and schema/record comparisons. Never restore over production for a drill.
- Physical iPhone and Android: sign in/out, password reset, map gestures, 16-stop route optimize/reorder/save/reopen/navigation, calendar/lunch lifecycle, background/reopen, offline errors, keyboard and safe areas.
- Native purchase buttons absent; direct native server-action invocation blocked; existing entitlement recognized; account deletion/support accessible. Check store-console declarations against companion scope.
- Web billing: authorized card setup preserves original trial end, webhook retry, successful/failed first charge, cancel before trial end, monthly/annual tiers and exports.

A successful build, local database restore or Chromium test alone does not satisfy physical-device or hosted recovery requirements.
