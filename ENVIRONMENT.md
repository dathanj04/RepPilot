# Environment

Copy `.env.example` to `.env`. Do not commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Application Postgres URL |
| `DATABASE_URL_TEST` | For tests | Separate database used by `tests/workflows.test.ts` |
| `SESSION_PASSWORD` | Yes | iron-session password, at least 32 characters |
| `TOKEN_ENCRYPTION_KEY` | Yes | Base64 32-byte key for secure-link ciphertext |
| `CRON_SECRET` | For cron | Bearer token for `/api/cron/reminders` |
| `APP_URL` | Yes | Absolute origin used inside emails and copied links |
| `NEXT_PUBLIC_APP_URL` | Yes | Same origin for the browser |
| `GEMINI_API_KEY` | No | Enables Gemini extraction and briefing polish |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Enables the Google Maps JavaScript map |
| `GOOGLE_MAPS_API_KEY` | No | Reserved for server-side Routes, Places, and Geocoding |
| `RESEND_API_KEY` | No | Sends email. Absent keys log a demo delivery |
| `EMAIL_FROM` | No | From address when Resend is configured |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Reserved for Google Calendar OAuth |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | No | Reserved for Microsoft Graph |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | No | Reserved. Billing is not implemented |

The app starts without the optional keys. Screens label the missing integration instead of inventing a successful sync.

Local demo database used in this workspace:

```text
postgresql://reppilot:reppilot_local@127.0.0.1:5432/reppilot
postgresql://reppilot:reppilot_local@127.0.0.1:5432/reppilot_test
```

Change those passwords outside a private development machine.
