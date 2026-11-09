# Deployment

The app is a Next.js server application. It needs a long-lived Node server or a host that runs Next.js server actions, plus Postgres. Static export is not supported.

## Production checklist

1. Set every required variable in `ENVIRONMENT.md`. Use a unique `SESSION_PASSWORD`, `TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET`.
2. Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to the public origin.
3. `npm run build` compiles the site, then attempts `prisma migrate deploy`. A database the build cannot reach does not fail the compile. Reviewer accounts are created only when the database has no users, `SEED_PASSWORD` is at least 12 characters, and `TOKEN_ENCRYPTION_KEY` is set.
4. Run `npm start` after the build. The start script binds port `43123`. Change the port in `package.json` if the host expects another port.
5. Schedule `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` at least every 15 minutes. The Today page also processes due reminders for the signed-in organization, which is convenient in demo and not a substitute for the cron job.
6. Add Resend, map, and Gemini keys only after the accounts that own them are approved for this use.
7. Do not reseed a database that already has customer accounts. The empty-database bootstrap is only for a new reviewer environment.

## Vercel

`vercel.json` schedules `GET /api/cron/reminders` every 15 minutes. Vercel sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set on that environment. Sub-daily crons require a Vercel plan that allows them. The Today page still processes due reminders for the signed-in organization; the cron is the hosted worker.

Do not deploy or change DNS until the staging pass is approved. Preparing the project is separate from launching it.

### Environment separation

Use one Vercel project with Production and Preview, or two projects if you want a long-lived staging URL before a production domain exists.

| Vercel environment | `APP_ENV` | Database | Domain, after approval |
| --- | --- | --- | --- |
| Preview | `staging` | Neon `staging` | `staging.yourdomain` |
| Production | `production` | Neon `production` | `app.yourdomain` |

Set these in the Vercel environment, not in git: `DATABASE_URL`, `DIRECT_URL`, `SESSION_PASSWORD`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `APP_ENV`, `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_DSN`, and `SEED_PASSWORD` for a brand-new reviewer database. Use different session, token, and cron secrets per environment. Leave `NEXT_PUBLIC_DEMO_LOGIN` unset. The build seeds only an empty database.

`APP_URL` and `NEXT_PUBLIC_APP_URL` must be the https origin of that environment. Session cookies are `Secure` when `NODE_ENV` is production, which Vercel sets for both Preview and Production.

Build command: `npm run build`. Install runs `prisma generate`. Run `npm run db:migrate:deploy` as a release step with `DIRECT_URL` for that environment before traffic moves. Health check: `GET /api/health`. It returns 503 when Postgres is unreachable and does not include secrets.

### Custom domain

When you approve DNS, add the domain in Vercel and create the CNAME or A record Vercel shows. Point staging first. Leave production DNS unchanged until staging sign-in, check-in, reminder, and catering checks pass on https.

## Dependency review (26 Oct 2026)

`npm audit` reported 13 advisories before the upgrade pass. Classification:

| Package | Severity | Where it runs | Action |
| --- | --- | --- | --- |
| `vitest`, `tinypool`, `@vitest/mocker` | critical / moderate | Test runner only | Upgrade `vitest` to 5.x |
| `prisma`, `@prisma/config`, `deepmerge-ts` | high | Prisma CLI at migrate/generate, not request handling | Upgrade Prisma to 7.10.1 and override `deepmerge-ts` to 8.x |
| `mysql2` | high | Prisma CLI MySQL driver. The app uses `pg` | Override to 3.24.x. No MySQL connection is opened |
| `zod` nested under `shadcn` | high | Component CLI. App code already uses zod 4.6.7 | Upgrade `shadcn` and move it to devDependencies |
| `body-parser`, `undici`, `fast-uri` | high / moderate | `shadcn` CLI and Prisma dev tooling | Override to patched versions. They are not imported by app routes |

Authentication requires normal HttpOnly session cookies. The legacy JavaScript-readable preview cookie and bearer fallback are retired. Cursor preview ingress that strips cookies cannot support authenticated testing; use a direct HTTPS staging deployment. Existing preview workers are cleared and unregistered. Rotate `SESSION_PASSWORD` during rollout to invalidate previously issued preview credentials (all users must sign in again). Do not rotate `TOKEN_ENCRYPTION_KEY` for this change: existing encrypted clinic links depend on it.

The delivery-body redaction migration clears existing `NotificationDelivery.htmlBody` and `textBody` values. Deploy the updated sender before running that migration; old instances must stop writing bodies. Delivery metadata remains for diagnostics and idempotency. Existing backups may retain old content until their configured expiry.

## What is not production-hardened here

- No Stripe billing, no hosted file storage for receipts, and no object-storage upload scanner.
- No Google or Microsoft OAuth callback routes.
- No PostGIS proximity index.
- Reminder processing on page load is extra, not the only worker you should trust at volume.
- Clinic-link rate limits are stored in Postgres (`RateLimitBucket`) so more than one server shares them.
- There is no formal HIPAA assessment, penetration test, or compliance certification.

Treat a successful local test as evidence that the coded workflow runs, not as a certification.
