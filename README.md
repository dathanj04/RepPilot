# RepPilot AI

Less admin. More territory. More relationships.

RepPilot AI is a mobile-first operating system for healthcare field representatives. A rep can see the day, find an office, check in, schedule an educational lunch, and record catering spend without putting a clinic on an open booking calendar.

This build is a working application with a real PostgreSQL database. Several external services stay disconnected until you add credentials, and the product says so in the interface.

## What you can do

- Sign in, create an organization, and add people with roles.
- Create, edit, search, and CSV-import office accounts.
- See fictional demo offices on a territory map.
- Check in with tap targets or speech. Speech is reviewed before it is saved.
- Prepare for a visit from the practice profile. The brief uses prior notes, open follow-ups, and a verified CRM count only when a sync recorded one.
- Track follow-ups, an internal calendar, and an advisory route.
- Offer specific lunch times on a private clinic link.
- Confirm a lunch or request a change without a clinic account.
- Request catering with a lunch. The representative approves the time, and a different reviewer approves the catering. Then open ezCater or DoorDash and record the order and receipt yourself.
- Keep recorded spending separate from upcoming commitments.
- Review an internal meal policy. Approval cannot clear a prohibition.

## Demo sign-in

Seeded people use the password in your local `SEED_PASSWORD`. That value is not stored in this repository.

| Email | Role |
| --- | --- |
| alex.davis@example-health.test | Representative |
| jordan.lee@example-health.test | Manager |
| priya.shah@example-health.test | Organization administrator |
| casey.nguyen@example-health.test | Compliance administrator |
| avery.cole@reppilot.demo | Platform administrator |

The demonstration organization is Example Healthcare Services. Its offices, visits, and spending are fictional.

## Local setup

Requirements: Node.js 20+, PostgreSQL 16.

```bash
npm install
cp .env.example .env
```

Create the database, then set `DATABASE_URL`, `SESSION_PASSWORD` (32+ characters), and `TOKEN_ENCRYPTION_KEY` (32-byte key, base64). Generate a key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The app listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

`npm test` runs the domain tests and the database workflow tests. The workflow tests need `DATABASE_URL_TEST`.

## Honest limits

- Google Maps JavaScript is used only when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set. Otherwise the map is OpenStreetMap through Leaflet. Straight-line miles are labeled as straight-line miles.
- Places search, address geocoding, and Routes drive time run only when `GOOGLE_MAPS_API_KEY` is set. A missing key or a missing duration leaves those fields blank.
- Gemini is used only when `GEMINI_API_KEY` is set. Otherwise a deterministic parser fills the check-in draft and the visit brief. A model opener is kept only when it does not add numbers.
- Email is sent through Resend only when `RESEND_API_KEY` is set. Otherwise the message is stored as `logged_demo`.
- Google Calendar and Microsoft 365 are not connected. Lunches are stored on an internal calendar.
- Salesforce and HubSpot rows exist as not-connected placeholders.
- Stripe billing is not implemented. Plan prices are packaging labels.
- Opening a catering website does not place an order.
- RepPilot does not claim HIPAA compliance or legal certification.
- Do not store patient names, diagnoses, or other protected health information in notes.

See `ARCHITECTURE.md`, `DATABASE.md`, `DATABASE_SCHEMA.md`, `ENVIRONMENT_VARIABLES.md`, `INTEGRATIONS.md`, `DEPLOYMENT.md`, `SECURITY.md`, `TESTING.md`, and `PRODUCT_ROADMAP.md`.
