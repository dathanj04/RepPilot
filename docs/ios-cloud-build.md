# RepPilot iOS cloud build

Apple app: 6835507363. Bundle ID: app.reppilot.mobile. Team: FW85GD3YMF.
Android retains com.reppilot.app; set CAPACITOR_PLATFORM=android before Android Capacitor commands.

1. Sign up at https://codemagic.io using GitHub; add dathanj04/RepPilot as an Ionic Capacitor / other YAML app.
2. Select development and load codemagic.yaml. Workflow: ios-testflight.
3. In team integrations, add an Apple Developer Portal / App Store Connect integration named exactly `RepPilot Apple`. Upload the Apple API key directly there, with its key ID and issuer ID. Never commit the .p8 file or paste it into chat. Use the role required by Codemagic for automatic distribution signing.
4. In team code signing identities, generate or upload an Apple Distribution certificate (with its private key) and fetch/create an App Store provisioning profile for app.reppilot.mobile and team FW85GD3YMF. Do not revoke existing certificates. The workflow fetches matching uploaded identities; API integration alone does not supply a missing certificate private key.
5. Start the workflow manually. No push triggers are configured. Check service pricing/minutes before starting.
6. A successful publishing step uploads the signed IPA to App Store Connect. Both automatic beta review and App Store submission are disabled. After Apple processes it, complete export compliance, add an internal testing group and yourself as tester in TestFlight, then install TestFlight on your iPhone.

Not yet verified: hosted signing/export/upload, physical iPhone behavior, finalized privacy disclosures, store billing and App Review readiness. This workflow does not change the web deployment or grant paid access. No production database credentials or Stripe/Resend keys belong in this native build.
