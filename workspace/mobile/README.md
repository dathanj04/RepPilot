# RepPilot iOS and Android — internal testing candidate

Targets the latest ChatGPT-hosted RepPilot, not the separate Next.js app at reppilot.apps.grok.bot. Existing native project scaffolding was imported from dathanj04/RepPilot. App identifier com.reppilot.app is provisional until ownership and store records are verified. The current site remains owner-private; no credentials or access bypass tokens are bundled.

## Run

Node 22+ and Java 21. From this directory: `npm ci`, `npm run check`, then `npm run android:debug`. Android requires Android SDK 36, SDK licenses and build tools. For iOS use a Mac with Xcode and CocoaPods, then `npm run ios:open`. Configure the Apple development team in Xcode. Never commit certificates, profiles or signing keys.

`npm run android:release` deliberately fails until release evidence is complete. iOS submission must pass `npm run check:release` before archiving in Xcode. This package is not a signed IPA or Play AAB and has not been submitted.

## Required release evidence

- Sign-in on physical iOS/Android devices, including ChatGPT authorization, cookies, restart persistence and sign-out. Never embed the site's bypass token. If the native WebView cannot complete authorization, implement supported system-browser authentication with a dedicated mobile backend before release.
- Deliberately authorize review users and customer accounts; the current site only grants the owner access. Do not make private data public to satisfy this requirement.
- Public privacy/support URLs and account deletion working independently of owner sign-in. Review existing legal content against this implementation; do not link the unrelated older app's policies as a substitute.
- Decide on store-compliant purchase behavior. Existing web Stripe checkout must not be exposed in store builds without verifying applicable Apple/Google payment rules and supported programs. A consumption-only companion is one possible route, requiring implementation and review; no exemption is presumed.
- Meaningful mobile functionality and polished phone/tablet navigation; remote-web shells are not presumed to satisfy Apple minimum functionality. Check route navigation, permissions, maps, CSV/Excel import/export and lunch scheduling on both platforms.
- Real device screenshots, branded icon/splash review, App Privacy and Data Safety disclosures based on actual SDK/network/data collection, and signing credentials/store records.

Track evidence in release-readiness.json only after verification; false values are intentional.

## Signing and submission

Android release signing uses environment variables ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, or an ignored android/keystore.properties file. Release builds must be signed; keep the upload key securely backed up. Enable Play App Signing and upload a signed AAB to internal testing first.

On a Mac, select the correct team, unique bundle identifier and provisioning profile in Xcode. Archive, validate and distribute to TestFlight before App Review. Apple Developer enrollment and Play Console access for Culture Care do not establish access or app records for RepPilot.

## Source references

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/10281818

## Release tooling

`fastlane/Fastfile` includes signed archive/bundle and optional internal-distribution lanes. Install Ruby/Bundler and run `bundle install` from mobile. Lanes require local key file paths through environment variables; do not paste or commit credentials. The release evidence gate remains in place. Store metadata and privacy disclosures are drafts in STORE_LISTING.md. The website now supports authenticated deletion requests with a manager queue; deletion fulfillment is manual, not automatically executed by the request endpoint.
