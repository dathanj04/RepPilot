# Stripe 14-day trial rollout (not yet enabled)

This branch implements a **hosted Stripe Checkout** card-collection path. No card number or CVC is stored or logged by RepPilot. Customers can enter a payment card on iPhone or desktop. Checkout requests a 14-day subscription trial with a payment method collected immediately; Stripe controls the first invoice after the trial.

## Required before enabling production

1. Create **monthly recurring** Stripe Prices for Individual and Business. Confirm the approved prices with the owner; provisional roadmap numbers are *not* authority to bill.
2. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_INDIVIDUAL, STRIPE_PRICE_BUSINESS, and HTTPS APP_URL on the deployment. Never expose secret values with NEXT_PUBLIC_ variables.
3. Register the webhook URL `https://<production-host>/api/billing/webhook` in Stripe, subscribing to checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
4. Deploy the Prisma migration *before* the application code. Maintain isolated test-mode versus live-mode keys and separate test and production databases.
5. In Stripe test mode, verify iPhone Safari, desktop browsers, completed checkout with a saved card, canceled checkout, trial dates, repeat clicks, an expired trial, successful first invoice, declined card, subscription cancellation, webhook retries, and out-of-order delivery. Check that the customer is **not billed at signup**, and that the amount/date shown in Stripe match the price selected.
6. Validate tax, billing disclosures, terms, cancellation and access-control policies before accepting live payments. Implement customer self-service subscription management and payment-failure email prior to launch. RepPilot must not claim payment collection is live until test evidence exists.
7. Reconcile subscription records to Stripe daily. Treat Stripe as authoritative; never grant paid access solely from the preexisting `demo` status or a URL query parameter.

## Known remaining work

- Production subscription gating and payment-failure notifications remain pending. A Stripe billing portal entry is implemented but not end-to-end verified.
- A platform-operator overview and CSV export are implemented in this branch, but **have not yet been verified against live Stripe data or real subscriber records**.
- Durable webhook event-ID receipts and checkout reservations are implemented; concurrency, outage and replay tests still need to run.
- Checkout reservation now blocks overlapping requests. Recovery after lost responses, abandoned sessions and concurrent Stripe events needs validation.
- Automated end-to-end tests of live Stripe sandbox and deployment webhook delivery.

These are launch blockers, not optional polish.
