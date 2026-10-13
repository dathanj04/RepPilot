# Integrations

An integration is described as live only when credentials exist and a request succeeds. This repository ships adapters and honest empty states.

## Google Maps, Places, Geocoding, Routes

The territory map is interactive without a Google key. It uses Leaflet and OpenStreetMap tiles, office markers, filters, a selected-office card, Check In, and a Directions link. Straight-line miles are labeled as straight-line miles. Driving time is never invented.

When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is a real browser key, the same screen loads the Maps JavaScript API instead. Placeholder values such as `API KEY REQUIRED` are ignored so Google’s error tile does not replace the map.

`GOOGLE_MAPS_API_KEY` is reserved for server-side Routes, Places, and Geocoding. Those calls are not made in this build.

### Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Enable billing for that project. Maps Platform will not serve tiles without it.
3. Enable **Maps JavaScript API** for the browser map.
4. Enable **Routes API** only if you later want driving times. Leave it off until the app calls it.
5. Enable **Geocoding API** and **Places API** only when you want address lookup. They are unused today.
6. Create an API key for the browser. Restrict it to **HTTP referrers** that match your preview and production origins, and restrict the API to Maps JavaScript API.
7. Create a separate server key for Routes later. Restrict it by IP or to the Routes API. Do not put that key in `NEXT_PUBLIC_` variables.
8. Put the browser key in `.env` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Restart the dev server. Do not commit the key.

Directions still open `https://www.google.com/maps/dir/` with the office coordinates. That link does not need an API key.

## Gemini

`src/lib/ai/gemini.ts` calls Gemini only on the server. The response must match the check-in schema. Narratives that introduce numbers the application did not calculate are rejected. If the key is missing or the call fails, `extractCheckInDeterministic` in `src/lib/domain/extraction.ts` fills only details it can see in the transcript. The rep edits the draft and saves it. Nothing is sent to a clinic from an AI suggestion.

Account briefs are built from the last stored visit and open tasks. They link back to those records.

## Email

`deliverEmail` posts to Resend when `RESEND_API_KEY` and a recipient exist. Otherwise it writes `NotificationDelivery` with status `logged_demo`. Idempotency keys stop a second send of the same reminder or invitation. Templates in `src/lib/email/templates.ts` include HTML and plain text.

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
