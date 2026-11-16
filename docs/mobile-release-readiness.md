# RepPilot mobile release readiness

## Current target

Private Android debug and iOS simulator builds, not public store distribution. Production origin: https://reppilot.app. Bundle identifier: com.reppilot.app. The shell loads the online service; it does not promise offline access to accounts or visits.

## Completed preparation

- HTTPS-only origin validation; production origin replaces the obsolete preview host.
- Packaged connection-error screen with working reconnect, privacy, support, and account deletion links.
- RepPilot user-agent identifier for future platform-specific UX.
- Native launcher icon generation from the approved navy/mint logo.
- iOS and Android Capacitor asset synchronization and location permission declarations.
- Native preflight command and secret-free hosted debug/simulator build workflow.
- Existing trial, payment entitlement and account deletion automated tests run with the web test suite.

## Build commands

Run `npm ci`, `npm run mobile:icons` (Python + Pillow), and `npm run mobile:preflight`. Android requires Java 21 and an Android SDK; run `npm run mobile:android:debug`. iOS requires macOS/Xcode/CocoaPods; run `npm run mobile:ios`. GitHub Actions workflow “Private mobile beta builds” builds both targets on changes to native/build files on development, or via Run workflow. Artifacts expire after seven days. The Android APK is debug-signed for private testing. The iOS artifact runs in Simulator only, not on an iPhone or TestFlight.

## Release gates still open

- First hosted Android debug and iOS Simulator jobs succeeded (GitHub Actions run 43798571891). Resulting packages still need real-device/manual testing. The iOS artifact cannot run on an iPhone.
- Apple signing team, distribution certificate/profile and App Store Connect record; Android upload keystore and Play Console record. Do not commit signing files or paste credentials into chat.
- Test real-device login persistence, precise/approximate/denied location, office search/save, lasso touch gestures, routing, calendar links, receipt attachment, Android Back, keyboard, safe areas, app resume, no connection, and deletion.
- Confirm the purchasing design for each distribution region. Existing Stripe checkout is a web flow, not an implemented Apple/Google in-app subscription flow. The native test shell now hides purchase controls and blocks Checkout/portal actions until a store billing channel is implemented; web browser billing remains available. Do not submit the current billing WebView as a globally compliant store checkout. Paid access must continue to fail closed. A marker in a user agent is not an entitlement or an authentication mechanism.
- Test hosted Stripe sandbox success, decline, renewal, cancellation and trial expiration against an isolated test database. The current Vercel Preview shares the production database; never use it for simulated purchases/deletions.
- Prior requests for early card collection and a restricted Individual tier are not implemented in the current Business-only billing flow. Product pricing and matching Stripe catalog/entitlements must be settled before claiming these features.
- Production email needs RESEND_API_KEY plus a verified EMAIL_FROM; monitoring needs a real SENTRY_DSN. No placeholder keys or fabricated health status. Configure only through the hosting secret form, then test delivery to an authorized inbox and verify error collection.
- Review privacy policy, account-deletion retention behavior, store data-safety/privacy disclosures, location purposes, subscription descriptions, review credentials, screenshots and age/category metadata against actual behavior.

## Local build evidence

Capacitor copy for both platforms and Android update succeeded. TypeScript validation succeeded after installing the declared native tooling. Android assembleDebug was attempted but Gradle distribution download failed because the local Java process could not reach services.gradle.org. No Android SDK or Xcode is installed in this environment. These are build environment limitations, not proof of a working native binary.
