# Environment variables

Copy `.env.example` to `.env`. Do not commit `.env` or paste real secrets into documentation.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres URL used by the running app. On Neon this is the pooler host |
| `DIRECT_URL` | For migrations | Direct Neon URL used by `prisma migrate deploy`. Locally it can match `DATABASE_URL` |
| `DATABASE_URL_TEST` | For tests | Database used by `tests/workflows.test.ts` |
| `APP_ENV` | On a host | `development`, `staging`, or `production`. Production refuses the demo seed |
| `SESSION_PASSWORD` | Yes | iron-session password, at least 32 characters |
| `TOKEN_ENCRYPTION_KEY` | Yes | Base64 32-byte key for secure-link ciphertext |
| `CRON_SECRET` | For cron | Bearer token for `/api/cron/reminders` |
| `APP_URL` | Yes | Absolute origin used inside emails and copied links |
| `NEXT_PUBLIC_APP_URL` | Yes | Same origin for the browser |
| `NEXT_PUBLIC_DEMO_LOGIN` | No | `true` only on a private demo. Leave unset in production |
| `GEMINI_API_KEY` | No | Enables Gemini extraction. Absent key uses the deterministic parser |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Enables the Google Maps JavaScript map |
| `GOOGLE_MAPS_API_KEY` | No | Server key for Geocoding, Places API (New), and Routes. Absent key leaves those calls unmade |
| `RESEND_API_KEY` | Staging and production | Sends email. Local absence logs `logged_demo` |
| `EMAIL_FROM` | With Resend | Verified from address |
| `TEST_EMAIL_TO` | Transport test | Inbox you control. The test script refuses seeded office domains |
| `SENTRY_DSN` | Recommended | Sends server errors to Sentry. Empty disables the client |
| `ALERT_WEBHOOK_URL` | No | JSON webhook for delivery and server errors |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google Calendar OAuth. Absent values leave the connect button unavailable |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | No | Microsoft 365 calendar OAuth. Tenant defaults to `common` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | No | Reserved. Billing is not implemented |
| `ALLOW_DEMO_SEED` | No | Allows the demo seed against a non-local disposable database. Ignored when `APP_ENV` is production |

The app starts without the optional keys. Screens say the integration is disconnected.

Generate a token key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
