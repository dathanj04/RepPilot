# Deployment

The app is a Next.js server application. It needs a long-lived Node server or a host that runs Next.js server actions, plus Postgres. Static export is not supported.

## Production checklist

1. Set every required variable in `ENVIRONMENT.md`. Use a unique `SESSION_PASSWORD`, `TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET`.
2. Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to the public origin.
3. Run `npx prisma migrate deploy` against the production database.
4. Run `npm run build` and `npm start`. The start script binds port `43123`. Change the port in `package.json` if the host expects another port.
5. Schedule `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` at least every 15 minutes. The Today page also processes due reminders for the signed-in organization, which is convenient in demo and not a substitute for the cron job.
6. Add Resend, map, and Gemini keys only after the accounts that own them are approved for this use.
7. Do not seed demonstration data in a production organization.

## Vercel

This project can be deployed on Vercel with a managed Postgres database. Set the environment variables in the project settings. Point a Vercel Cron at `/api/cron/reminders` and send the bearer secret. `prisma generate` runs on `postinstall`.

Generated Prisma files are gitignored, so the install step has to be able to run `prisma generate`.

## What is not production-hardened here

- No Stripe billing, no hosted file storage for receipts, and no object-storage upload scanner.
- No Google or Microsoft OAuth callback routes.
- No PostGIS proximity index.
- Reminder processing on page load is extra, not the only worker you should trust at volume.
- Rate limiting for clinic links is in-memory and resets when the process restarts.
- There is no formal HIPAA assessment, penetration test, or compliance certification.

Treat a successful local test as evidence that the coded workflow runs, not as a certification.
