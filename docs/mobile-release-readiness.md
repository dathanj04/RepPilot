# Mobile release readiness

Updated November 17, 2026. Current verification evidence and remaining gates are recorded in [launch verification](launch-verification-2026-11-17.md).

- iOS bundle: `app.reppilot.mobile`; Android application: `com.reppilot.app`.
- Native apps are existing-workspace companions; native checkout and payment-management actions are blocked server-side. Web subscriptions remain available. Store acceptance has not been verified.
- Individual: $29/month or $290/year. Business: $48/month or $480/year. Original trial: 14 days. Optional web card authorization schedules conversion at the original trial end.
- An owner-installed TestFlight build was reported. Previous Android debug and iOS simulator CI builds are not physical-device acceptance evidence.
- Preview no longer receives shared production secrets. A functioning isolated hosted staging database and hosted backup recovery drill remain required.
- Live calendar OAuth, CRM referral queries and generative AI must not be advertised before their live acceptance tests pass.

Do not declare launch ready based only on a successful archive, screenshot, automated browser suite or local restore drill.
