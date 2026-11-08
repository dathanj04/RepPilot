# Environment

The variable list is maintained in `ENVIRONMENT_VARIABLES.md`. Copy `.env.example` to `.env`. Do not commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres URL used by the running app. On Neon this is the `-pooler` host |
| `DIRECT_URL` | For migrations | Direct Neon URL used by `prisma migrate deploy`. Locally it can match `DATABASE_URL` |
| `DATABASE_URL_TEST` | For tests | Separate database used by `tests/workflows.test.ts` |
| `APP_ENV` | Yes on a host | `development`, `staging`, or `production`. Production refuses the demo seed |
| `SESSION_PASSWORD` | Yes | iron-session password, at least 32 random characters. There is no built-in fallback |
| `SEED_PASSWORD` | For local seed | At least 12 characters. Used only by `npm run db:seed`. Do not commit it |
| `TOKEN_ENCRYPTION_KEY` | Yes | Base64 32-byte key for secure-link ciphertext |
| `CRON_SECRET` | For cron | Bearer token for `/api/cron/reminders` |
| `APP_URL` | Yes | Absolute origin used inside emails and copied links |
| `NEXT_PUBLIC_APP_URL` | Yes | Same origin for the browser |
| `NEXT_PUBLIC_DEMO_LOGIN` | No | Set to `true` only on a private demo. Production leaves it unset so seeded passwords are not rendered |
| `GEMINI_API_KEY` | No | Enables briefing polish. Visit notes are not sent to the model |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Enables the Google Maps JavaScript map |
| `GOOGLE_MAPS_API_KEY` | No | Server key for Geocoding, Places API (New), and Routes. Absent key leaves those calls unmade |
| `RESEND_API_KEY` | Required on staging and production | Sends email. A local missing key logs `logged_demo`. Staging and production refuse to mark a reminder sent without it |
| `EMAIL_FROM` | Required with Resend | Verified from address, for example `RepPilot <notifications@yourdomain.com>` |
| `TEST_EMAIL_TO` | For the transport test | Inbox you control. `npm run email:test` refuses seeded office domains |
| `SENTRY_DSN` | Recommended | Sends server errors to Sentry. Empty disables the client |
| `ALERT_WEBHOOK_URL` | Optional | Receives JSON when email delivery or a server error fails |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google Calendar OAuth. Absent values leave connect unavailable |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | No | Reserved for Microsoft Graph |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | No | Reserved. Billing is not implemented |

The app starts without the optional keys. Screens label the missing integration instead of inventing a successful sync.

Local demo database used in this workspace:

```text
postgresql://<DB_USER>:<DB_PASSWORD>@127.0.0.1:5432/reppilot
postgresql://<DB_USER>:<DB_PASSWORD>@127.0.0.1:5432/reppilot_test
```

Replace the placeholders with unique local credentials; never reuse development credentials on a hosted database.
