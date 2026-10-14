# Collaboration, Inbox and attachments

This guide covers the internal collaboration workflow implemented in REKA. It is scoped to current authenticated workspace members; it does not provide public comments, external client access, email delivery, or realtime multi-cursor editing.

## Issue discussion

- Comments are stored on their issue and appear in the comment/activity timeline. A commenter can edit or remove their own comment; a workspace owner/admin may moderate only issues they can already access. The API validates write access on every operation. Read-only guest/client memberships and team viewers cannot write.
- Mention a visible workspace member by entering `@` and selecting a suggestion (the saved handle uses their GitHub username, or email local-part where unavailable). The server resolves actual active workspace accounts and checks issue access again before creating a mention notification. An unavailable/non-member/private-team-ineligible recipient cannot receive private issue content.
- Use **Follow issue** to subscribe/unsubscribe as yourself. A subscription is per-user and survives reloads. Subscribers can receive comments and issue-update notifications; authors are not notified about their own actions. Notification preferences can suppress categories without rejecting the underlying comment or issue update.
- Activity and discussion are shared records. Open the Activity tab to review comment, attachment and issue events. The issue detail refreshes comments, attachments and activity on a five-second foreground polling interval; this is polling, not WebSocket/push delivery.

## Personal Inbox and preferences

The Inbox is distinct from team Triage. It supports unread/all, mentions, assignments, pull-request/GitHub and updates filters; mark one/all read, delete personal notifications, clear read notifications, and open linked work. Personal read state is server-persisted. The Inbox refreshes notifications and unread count every 15 seconds while active.

Open **Notification preferences** from the Inbox toolbar to enable/disable mentions, comments, assignments, issue updates, project updates, GitHub events and team invitations. New accounts without a saved preference row default to all categories enabled. These settings affect new notification creation; they do not erase existing Inbox history. Reads also re-check current issue/project/team access, so stale private-resource notifications are omitted after access changes.

There is no email/push transport. Do not interpret the UI polling interval as guaranteed delivery latency or claim a live external notification-provider integration.

## Issue attachments

Files are stored as bytes in the Postgres attachments table so REKA can preserve issue-level authorization without a public object URL or separately provisioned storage account. Uploads are limited to 5 MiB and one file at a time. Supported content is PNG, JPEG, GIF, WebP, PDF, UTF-8 plain text and UTF-8 Markdown; binary image/PDF signatures and text encoding are checked server-side. Names are sanitized. Upload requires issue write access; downloads require current issue read access; delete requires the uploader's writable team membership or an authorized team/workspace manager with access. Downloads use `application/octet-stream`, `nosniff` and private/no-store caching.

Legacy attachment rows keep their original URL and metadata. Since the old URL did not provide bytes under REKA's new authenticated storage model, downloading a legacy row without stored content returns `410 Gone`; migration does not fetch external URLs. Postgres backups include new file bytes, and file reads consume database/egress resources. There is no CDN, public share link, virus-scanning service or external object-storage lifecycle in this implementation; revisit that trade-off before increasing the size limit or expected file volume.

## Database and verification

Migration `0023_good_puck.sql` is additive: it creates per-issue subscriptions and per-user preferences, and adds nullable byte storage so existing attachment locations/comments/notifications remain intact. It has been exercised only in fresh/staged isolated Postgres test databases. **The configured parent database has not been migrated.** Obtain explicit approval before applying it to an existing database, production, or a deployment. Back up and rehearse the migration against an authorized copy before rollout.

Run isolated API/Postgres permission, preference, file-size/signature, restart and migration-preservation checks:

```sh
pnpm test:collaboration
```

For the authenticated browser → Nest HTTP → isolated Postgres test, start the existing Vite dev server (`pnpm --filter @reka/web dev`), configure `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for the local Playwright/Chromium installation where needed, then run:

```sh
pnpm test:web:collaboration-real-api
```

The browser acceptance test uses separate owner/member sessions to follow, mention, comment, read Inbox notifications, save preferences and exchange an attachment. It captures issue/Inbox layouts at desktop/mobile widths in both themes under `/tmp/reka-collaboration-*`. Test fixtures are controlled local records; they do not prove live GitHub OAuth, webhook delivery, email or production migration behavior.
