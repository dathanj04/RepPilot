# Integrations

An integration is described as live only when credentials exist and a request succeeds. This repository ships adapters and honest empty states.

## Google Maps, Places, Geocoding, Routes

The territory map works without a Google key. It uses Leaflet and OpenStreetMap tiles, office markers colored by visit status, filters for city, ZIP, territory, owner, and status, a selected-office card, Check In, and a Directions link. Straight-line miles stay labeled as straight-line miles.

When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is a real browser key, the same screen loads the Maps JavaScript API. Placeholder values are ignored so Google’s error tile does not replace the map. Pins use the same visit colors. The browser key is restricted to map tiles. It is not used for Places, Geocoding, or Routes.

`GOOGLE_MAPS_API_KEY` is a separate server key. The app calls Google only when that value is present:

- **Geocoding API** when an office is saved without latitude and longitude. Only `ROOFTOP` and `RANGE_INTERPOLATED` matches are stored. An approximate city centroid is rejected, and the office is saved without a pin.
- **Places API (New)** text search from My Territory. Results without a street, city, state, and ZIP are dropped. Nothing is saved until the representative types a specialty and presses Add. Duplicate name, street, and ZIP inside the organization are blocked.
- **Routes API** from Route Planner after Check drive time. The stop order the representative set is sent as-is, including upcoming lunches as fixed times. Duration is shown only when Google returns `duration` on the route and every leg. If that duration differs from `staticDuration`, the screen says current traffic changed it. A failed or unconfigured call leaves drive time blank.

Each successful or failed server call writes an audit row (`maps.geocode`, `maps.places`, `maps.routes`) with a status and, for Places, a result count. The row does not store the query, the address, or the Google payload. Places search is limited to 20 calls per representative per 10 minutes. Drive-time checks are limited to 30 per 10 minutes.

### Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Enable billing for that project. Maps Platform will not serve tiles without it.
3. Enable **Maps JavaScript API** for the browser map.
4. Enable **Geocoding API**, **Places API (New)**, and **Routes API** for the server key.
5. Create a browser API key. Restrict it to **HTTP referrers** for your preview and production origins, and restrict the API to Maps JavaScript API.
6. Create a separate server key. Restrict it to Geocoding API, Places API (New), and Routes API. Do not put that key in a `NEXT_PUBLIC_` variable.
7. Put the browser key in `.env` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and the server key as `GOOGLE_MAPS_API_KEY`. Restart the dev server. Do not commit either key.

Directions and multi-stop navigation open `https://www.google.com/maps/dir/` with the office coordinates. That link does not need an API key and does not create a drive-time claim inside RepPilot.

## Gemini

`src/lib/ai/gemini.ts` calls Gemini only on the server. The response must match the check-in schema. Narratives that introduce numbers the application did not calculate are rejected. If the key is missing or the call fails, `extractCheckInDeterministic` in `src/lib/domain/extraction.ts` fills only details it can see in the transcript. The rep edits the draft and saves it. Nothing is sent to a clinic from an AI suggestion.

Account briefs are built from the last stored visit and open tasks. They link back to those records.

## Email

`deliverEmail` posts to Resend when `RESEND_API_KEY` and a recipient exist. A local missing key writes `NotificationDelivery` with status `logged_demo`. Staging and production throw instead of logging a fake send, and the reminder stays scheduled. A `sent` row, plus Resend's `Idempotency-Key`, stops a retry from sending twice. A crashed `sending` row can be claimed again after two minutes. Templates in `src/lib/email/templates.ts` include HTML and plain text.

`npm run email:test` sends one message to `TEST_EMAIL_TO` after you set `RESEND_API_KEY` and `EMAIL_FROM`. It refuses `@example.com`, `@example-health.test`, and `@reppilot.demo`. It does not read clinic addresses from the database.

Hosted scheduling is the Vercel cron in `vercel.json`, every 15 minutes, calling `/api/cron/reminders`. The route still requires `Authorization: Bearer $CRON_SECRET`.

Sentry receives server errors when `SENTRY_DSN` is set. `GET /api/health` checks Postgres. `ALERT_WEBHOOK_URL` receives the same operational failures as JSON if you want a Slack or paging webhook before Sentry alerts are configured in the Sentry project.

Invitation, seven-day, and 48-hour messages identify the representative and organization. There is no marketing list.

## Calendar

Google and Microsoft connection rows are `not_connected` until OAuth is implemented and tested. Accepted lunches create an internal `CalendarEventMapping`. Clinic pages never receive the representative's other event titles.

Busy/free from an external calendar is not read in this build, so invitation slots are exactly the times the representative typed.

## Catering

ezCater and DoorDash buttons open `https://www.ezcater.com/` and `https://www.doordash.com/`. The schedule-lunch page shows the same links before a lunch exists. Opening a provider site does not place, pay for, or complete an order. On a saved lunch, a separate control marks the lunch `ORDERING_EXTERNALLY`. The rep records vendor, amount, reference, and status after returning. Uber Eats is shown as not connected.

A group-order URL can be saved on the order. The clinic is not given the representative's payment method.

## CRM

Salesforce and HubSpot have `ExternalCRMConnection` rows with status `not_connected`. There is no sync. Basic use does not require either.

## Stripe

No Checkout session, webhook, or entitlement enforcement is implemented. Seed subscriptions store a plan name and a listed monthly price so the platform screen can show packaging. They do not charge a card.
