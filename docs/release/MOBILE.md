# iOS and Android

RepPilot’s store binaries are a native shell around the hosted app, plus a bundled page for privacy, support, and account deletion when the network is down. The product behavior is the server app. A website-only wrapper can still be rejected for minimum functionality. Physical iPhone and Android passes are still required before submission.

## Projects

- Bundle id: `com.reppilot.app`
- `capacitor.config.ts` loads `CAPACITOR_SERVER_URL`, or https://reppilot.apps.grok.bot when that variable is unset
- `mobile/www` is the offline page shipped inside the binary
- iOS usage strings cover location, camera, and photo library because check-in and receipt upload can ask for them
- Android declares the same three permissions

Generate or refresh the native projects with `npm run mobile:sync`.

## Android signature

The release build reads a keystore that is not in git.

1. Create an upload key with `keytool` and store it outside the repository.
2. Put the path and passwords in `android/keystore.properties` (ignored) or export `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`.
3. Run `npm run mobile:android`. This produces `android/app/build/outputs/bundle/release/app-release.aab` when the Android SDK and a keystore are present.

Play App Signing should hold the app signing key. The upload key stays with the account owner.

## iOS signature

The iOS project can be generated on this machine. Archiving a signed IPA needs Xcode 26 or later, the iOS 26 SDK, and the Apple Developer account for this company. Open `ios/App/App.xcworkspace`, set the team, and archive. Recheck Apple’s SDK rule on the day you submit.
