# Stripe billing and access

The original server-created trial lasts exactly 14 days. Monthly and annual options are visible during the trial, and each user can save a personal billing preference without creating a Stripe customer, subscription or scheduled payment. Checkout opens only after the trial ends; no card is charged automatically at expiry. An expired workspace can access billing, support, sign-out and account deletion, but cannot access app pages, exports, receipts, calendar connections, or public scheduling/office links.

After expiry every protected server request verifies the bound customer's current Stripe subscription using an uncached request. Access requires the live approved Business price, matching organization metadata, active status, a paid latest invoice, and an unexpired item period. Checkout query strings, local `active` flags and browser state never grant access. Missing credentials, errors, unpaid/past-due/paused/canceled subscriptions fail closed. Cancellation at period end retains access through the paid period.

## Activation

Add the live RepPilot AI account's `STRIPE_SECRET_KEY` securely to Vercel project `reppilot`, Production environment, and redeploy. Never commit the key or paste it into chat. Prefer a restricted key with customer read/write, subscription read, invoice read, Checkout session read/write, and customer portal session write permissions. Preview should use a separate test database and Stripe test catalog before payment testing; the current Preview shares the live database, so do not run simulated purchases there.

The application uses the existing live Business monthly ($58.65) and annual ($591.60) prices, with Stripe Tax enabled. Tax settings and the Texas registration are active; tax calculation is not yet verified. The configured customer portal enables contact/payment updates, invoice history and cancellation at period end. No webhook is required for this access design because paid entitlement is fetched from Stripe on each protected request rather than trusted from asynchronous local status.

An individual workspace owner can subscribe and manage their own payment details. In a shared workspace the authenticated first payer is bound server-side; its payer or organization owner can manage the shared payment subscription. Customer IDs, prices and return URLs cannot be supplied by the browser. Unfinished Checkout sessions are reused and creation is idempotent to avoid duplicate subscriptions.

## Release verification

Targeted automated tests cover trial boundaries, unverified local status, subscription/customer/organization/price mismatches, unpaid and canceled states, API outages, public link entitlement, checkout ownership, fixed catalog pricing, tax request settings, no second trial, and duplicate subscription prevention. An actual hosted Checkout purchase, decline, renewal and portal cancellation must still be checked in an isolated Stripe sandbox before declaring payment flow verified. Do not use real card charges for a smoke test.
