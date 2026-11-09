# Reviewer access

The store listing must not sit behind the Cursor sign-in gate. In the app’s Publish settings, choose who can open it so an unsigned-in reviewer reaches the RepPilot login page.

Reviewer accounts exist only after the hosted database is empty and `SEED_PASSWORD` is set to at least 12 characters. The build applies migrations, including the email-body cleanup, then creates the demonstration organization once. It does not print the password and does not reseed a database that already has accounts.

Use these addresses in the App Store and Play reviewer notes, and paste the password there yourself. It is the same value as `SEED_PASSWORD`. Do not put that value in the repository or in chat.

| Role | Email |
| --- | --- |
| Representative | alex.davis@example-health.test |
| Platform operator | avery.cole@reppilot.demo |

Deletion is under Settings → Delete account, and at `/delete-account` without installing the app. The operator for backup and provider cleanup is dathan@abagrowth.com.

Before reviewers use a deployed build, replace `SESSION_PASSWORD` with a new value of at least 32 characters. That signs everyone out. Leave `TOKEN_ENCRYPTION_KEY` unchanged so existing encrypted links still open.
