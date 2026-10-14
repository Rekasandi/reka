# GitHub integration

REKA's GitHub flow is the existing single-workspace GitHub App integration. It supports verified repository connections, issue-key branch/PR associations, selected pull-request and review events, and durable webhook processing. It is not a general automation builder or complete GitHub Checks integration.

## Configuration and setup

Configure the existing application/API and worker environment before connecting an installation:

- `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_APP_SLUG` (optional; defaults to `reka-platform`) for App installation verification.
- `GITHUB_WEBHOOK_SECRET` for exact raw-body HMAC-SHA256 validation. Missing secret/raw body/signature fails closed.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` retain GitHub login configuration; they are separate from App installation verification.
- `DATABASE_URL` and `REDIS_URL` (or the existing Redis host/port/password settings) for API persistence and the worker queue.
- `WEB_URL` for installation callback redirects.

The configured GitHub App must send webhook deliveries to `POST /api/integrations/github/webhook` and include the standard `X-GitHub-Delivery`, `X-GitHub-Event`, and `X-Hub-Signature-256` headers. Subscribe it to `push`, `create`, `delete`, `pull_request`, and `pull_request_review` events. Workspace owners/admins connect the App and select repositories in **Settings → GitHub**. Project-linked repositories constrain which repositories can be selected for that project's issues; issues without a project use repositories visible to that workspace/team actor.

No setup step here creates an App, sends a live event, changes an existing database, or deploys the app. Verify these steps in an isolated environment first. Never commit App private keys, OAuth secrets, webhook secrets, or user tokens.

## Supported event behavior

- Branch `push` events for `refs/heads/*` upsert the latest SHA and associate identifiers matching the issue key (for example `feature/ENG-42-fix`). Pending issues can move into the team's first configured `started` state. Branch deletion removes its visible association and records one activity. GitHub `create` events are acknowledged, but normally omit the head SHA, so the first authoritative association is the following push.
- Pull-request `opened`/`reopened` moves a referenced issue into its team's configured active (`started`) state. An unmerged close records a closed PR without completing the issue. A merged close moves it into the configured `completed` state.
- `review_requested` notifies the mapped GitHub identity when it is a current workspace member. Submitted `approved` and `changes_requested` reviews update the PR review state and notify eligible issue recipients. PR edits/synchronizations refresh stored PR state without manufacturing notifications.
- Issue references are parsed from the branch and PR title. Existing PR→issue associations are authoritative and cannot be retargeted by later title text. Repository/installation workspace scope is rechecked by the worker.
- Notifications exclude the mapped actor, honor notification category preferences, and recheck current workspace/team access. Private-team recipients require explicit team membership. Unknown/unlinked events can be safely acknowledged without issue mutation.
- Issue workflow targets use the team's configured state categories. `started` is not assumed to have the literal key `in_review`, and `completed` is not assumed to have the literal key `done`.
- CI checks are not ingested by this workflow. Until a future GitHub Checks acceptance/milestone, the issue UI reports **CI status not reported** rather than claiming success or progress.

## Delivery and failure recovery

The API verifies the signature over the original request bytes before storing a durable `webhook_events` record. A duplicate delivery reuses the same row/job instead of creating another queue item; a retained failed BullMQ job is retried when GitHub redelivers it. Jobs use five attempts with exponential backoff beginning at one second and are retained on failure. Worker writes are scoped and idempotent by delivery ID; transient errors are saved on the delivery row and rethrown so BullMQ can retry. The Settings → GitHub page exposes only the latest 20 delivery IDs/event names/processing outcomes/errors for installations in the current workspace, and only to owners/admins; raw webhook payloads are not returned.

Branch-link uniqueness migration `0024_github_branch_links.sql` refuses to proceed if duplicate existing branch associations need reconciliation. Activity delivery deduplication migrations `0025_github_activity_delivery_idempotency.sql` and `0026_github_activity_event_scope_idempotency.sql` similarly stop on ambiguous historical GitHub event rows and preserve existing activity. Review the explicit duplicate rows and reconcile them before applying those migrations to any existing database. These migrations have only been exercised on disposable PGlite databases in this repository; no configured Neon parent database or production database was migrated.

## Verification evidence and limits

Run `pnpm test:github` for isolated API signature/workspace/provider-contract tests and worker/Postgres replay/retry/migration tests. Run `PLAYWRIGHT_MODULE=… PLAYWRIGHT_CHROMIUM_EXECUTABLE=… pnpm test:web:collaboration-real-api` for authenticated browser→Nest→isolated Postgres PR linking with a controlled GitHub API fixture, branch/PR display, and workspace-scoped delivery failure visibility. The controlled fetch fixture verifies the contract and data flow, not GitHub's live OAuth/App installation, webhook delivery, permissions, or provider behavior.

No live GitHub account/App/webhook smoke test has been performed or claimed. Obtain explicit authorization and appropriate credentials before any live installation, webhook write, or provider-side change.
