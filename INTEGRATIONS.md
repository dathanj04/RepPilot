# Integrations

An integration is described as live only when credentials exist and a request succeeds. This repository ships adapters and honest empty states.

## Google Maps, Places, Geocoding, Routes

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` loads the Maps JavaScript API on the territory map. Without it, Leaflet draws an OpenStreetMap-style basemap and the same office markers.

Directions open Google Maps with the office coordinates or address. The app does not call the Routes API yet, so it does not show a driving time. Straight-line distance is labeled as straight-line distance.

Places and Geocoding are not called. Offices are stored from the form, CSV import, or seed data.

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

ezCater and DoorDash buttons open `https://www.ezcater.com/` and `https://www.doordash.com/`. A separate control marks the lunch `ORDERING_EXTERNALLY`. The rep records vendor, amount, reference, and status after returning. Uber Eats is shown as not connected.

A group-order URL can be saved on the order. The clinic is not given the representative's payment method.

## CRM

Salesforce and HubSpot have `ExternalCRMConnection` rows with status `not_connected`. There is no sync. Basic use does not require either.

## Stripe

No Checkout session, webhook, or entitlement enforcement is implemented. Seed subscriptions store a plan name and a listed monthly price so the platform screen can show packaging. They do not charge a card.
