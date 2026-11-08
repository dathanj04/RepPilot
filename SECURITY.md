# Security

RepPilot is built so a representative's records stay inside one organization and a clinic link cannot browse anything else. That is an engineering control. It is not a legal or HIPAA certification.

## Access

- Passwords are hashed with bcrypt.
- The session cookie is sealed by iron-session and is httpOnly.
- Server actions call `getCurrentUser` and then filter by `organizationId`.
- Platform administrators are redirected away from the representative application.
- Clinic guests do not get accounts. They present a random token.

## Links

Tokens are 32 random bytes, encoded for URLs. Lookup uses SHA-256. A copyable ciphertext uses AES-256-GCM with `TOKEN_ENCRYPTION_KEY`. Links expire, can be revoked, and are scoped to one purpose: invitation, lunch confirmation, or office request.

Accepting an invitation revokes that invitation token. Confirmation links are revoked and reissued when a 48-hour reminder is sent. A canceled lunch cannot be confirmed. An expired invitation cannot book. The office page can send a request. It cannot create a lunch.

Logs record link purpose and id, not the raw token.

## Clinic traffic

`clinicRespondAction` rate-limits by a prefix of the token in process memory. That slows guessing on one server. Put a shared limiter in front of the app before a public launch.

Public pages render the office name, the offered times or the one lunch, the representative's name, and a mailto link. They do not render territory, other offices, notes, spending, or calendar titles.

## Data handling

Account notes and check-ins reject text that looks like a patient reference. The dictation prompt warns the rep not to dictate patient information. The extractor drops sentences that look like protected health information and does not invent activities.

Audit rows record invitation creation, lunch confirmation, and policy decisions. Check-in edits go through `updateCheckIn`, which writes an audit entry.

## Things this code does not do

- It does not encrypt the whole database.
- It does not prove that a deployment meets HIPAA, SOC 2, or a payer rule.
- It does not let an approval override entertainment or referral-linked meal blocks.
- It does not send email or place catering orders without the representative's action and, for email, a configured provider.

## Security review follow-up

Practice edits and new contacts/notes require assignment, or a manager/organization administrator role in the same organization. Task changes require ownership or that same team-edit role. Check-in edits require the original author. Catering order entry and handoff require the booking representative. Read visibility is unchanged.

Website links accept only absolute HTTP(S) URLs without embedded credentials, both on save and display. Stored legacy values are validated before rendering.

Email delivery bodies are not retained in delivery records. The redaction migration clears existing copies, including embedded clinic-link tokens. Delivery status, recipient, subject and provider identifiers remain restricted to server-side delivery processing; this change does not purge backups or provider records. Establish metadata and backup retention with the hosting operator before launch.

The credential previously shown in ENVIRONMENT.md was labeled local development. If reused elsewhere, rotate it with the database operator. Removing the example does not remove git history or revoke a live credential.
