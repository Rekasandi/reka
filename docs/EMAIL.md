# Email (SMTP)

REKA sends email through a single SMTP account configured only by environment variables (`.env`, never committed). Without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` the app works exactly as before: invitation links can still be copied, and no notification emails are sent.

## Configuration

| Variable | Meaning |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` | Server and port. `587` uses STARTTLS (required); `465` uses implicit TLS (or set `SMTP_SECURE=true`). |
| `SMTP_USER`, `SMTP_PASS` | Login. Quote the password in `.env` if it contains `#`. |
| `SMTP_FROM` | Visible sender, e.g. `"REKA <no-reply@rekasandi.com>"`. Defaults to `REKA <SMTP_USER>`. |
| `SMTP_REPLY_TO` | Where replies go, e.g. `info@rekasandi.com`. |

TLS certificates are always verified. Restart the API after changing these values.

## What is emailed

- **Workspace invitations** — creating an invitation (Users → Invite user) emails the single-use link to the invitee unless "Email the invitation" is unticked (`sendEmail: false`). The link is always returned too, so a mail failure or missing configuration never blocks an invitation; the dialog says whether the email went out. Only owners/admins can invite.
- **Notification emails** — opt-in per user: **Inbox → Notification preferences → Email me too** (`emailNotifications`, default off). When on, each in-app notification that the user's category settings allow is also emailed, with a link back to REKA. Opt-in keeps demo/test accounts with placeholder addresses from generating bounces.

Delivery is best-effort: failures are logged without secrets, and never fail the request that triggered them. Notifications created by the worker (GitHub pull-request events) are in-app only.

## Verifying

`pnpm test:email` exercises both flows against an in-memory transport (no network, no real email). To check the live server without sending anything, call `MailService.verify()` (connects and authenticates only).

## Self-signed mail server certificates

`SMTP_IGNORE_TLS=true` skips certificate verification (and STARTTLS enforcement) so a server with a self-signed certificate can still send. The SMTP password can then be intercepted, and the API logs a warning at the first send. Prefer installing a valid certificate on the mail server or using a managed provider such as Resend (`SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_PASS=<API key>`).

