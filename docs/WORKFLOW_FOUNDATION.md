# Workflow foundation — staged, not deployed

Goal: `mv6rv5a2-43ym1x`. Scope/acceptance inventory: [LINEAR_WORKFLOW_MATRIX.md](LINEAR_WORKFLOW_MATRIX.md).

## Changes

- `packages/database/drizzle/0004_workflow_foundation.sql`: non-destructive schema addition for private-team visibility, active workspace membership, hashed invitations, and ordered issue history.
- Existing users are enrolled only when there is a single existing organization; roles and existing membership rows are preserved. No user is promoted to owner automatically. Multiple existing organizations cause the entire migration to roll back, requiring an explicit company selection plan.
- `workspace_invitations` holds a SHA-256 hash, normalized email, bounded member/admin role, expiration, acceptance/revocation timestamps and inviter identity. This is schema only; invitation issuance/acceptance and GitHub verified-identity enforcement belong to the workspace-access milestone.
- `issue_history` captures database issue insert/update/delete writes, including worker/direct SQL changes. Timestamp-only updates are ignored. Events survive individual issue deletion, but team deletion retains existing cascade behavior.
- Every existing issue receives a **baseline** event at instrumentation start. A baseline is not issue creation or historic completion. No pre-migration delivery curve is reconstructed.
- Known creation actor is the stored reporter. Unknown update/delete actors remain NULL, not guessed from reporter/assignee. Authenticated action attribution still needs the Issues/Collaboration/GitHub milestones; this foundation is not a completed audit log feature.
- Source schema currently omits the physically existing `milestones` table/`issues.milestone_id` from migration 0000. Tests explicitly preserve both and their existing data. A future milestones migration must reconcile this drift safely, not blindly create/drop those objects.

## Migration safety

**No migration on the existing DATABASE_URL or production has been run or authorized.** Do not deploy/restart the new schema build against an un-migrated existing database: selects may reference the new columns. The code/migration is staged and validated only against isolated test databases.

Before existing-database rollout:

1. Get explicit user approval, confirm the selected internal company and identify its existing owner. If no owner exists, use an explicitly authorized bootstrap identity, never the first arbitrary GitHub login.
2. Back up/snapshot the target database and inspect the checked-in migration journal versus applied migrations. In particular, preserve historical milestone objects and unrelated prior changes.
3. Test the migration against an isolated production-like copy; compare row counts, roles, memberships, issue/milestone links, and original field values.
4. Apply through the existing Drizzle migration workflow using the appropriate direct connection only after approval.
5. Deploy the matching application build, run controlled smoke tests and review access before inviting anyone. Membership/private-team enforcement is not implemented by adding columns alone.

## Repeatable isolated checks

All foundation checks below use temporary PGlite/Postgres storage. They do not load `.env`, connect to DATABASE_URL, start Redis, perform live OAuth or write to GitHub.

```sh
pnpm test:workflow-foundation
pnpm type-check
```

`test:workflow-foundation` builds the API/worker dependencies and currently runs eight integration checks:

- Staged legacy -> current migration preserves users, roles, issue/project/milestone rows and icons.
- Baseline cutoff, direct-write snapshots, failed-update rollback, no-op suppression, issue deletion history and process-restart persistence.
- Ambiguous multiple-company migration fails atomically without granting memberships.
- Invitation schema constraint/hash persistence.
- Actual loopback Nest HTTP with the real AuthGuard/DTO/controller/service and temporary Postgres: valid-session issue creation, unauthorized request rejection, invalid DTO rejection, update/restart/history persistence.
- Existing API notification and worker PR-event restart persistence regressions.
- Branch-event transition/idempotency and current private-team notification recipient filtering.

The shared helper `apps/api/test/support/persistent-postgres.cjs` now uses Drizzle's real migration runner and journal, supports staged migration tests, and reopens the same temporary database. `apps/api/test/support/isolated-api.cjs` mounts selected real Nest modules with a substituted test DatabaseService; it never imports the application config or external infrastructure modules.

### Browser -> actual API -> database

With Vite running on `WEB_URL` (default `http://localhost:5173`):

```sh
# Run the build/integration checks first, then:
pnpm test:web:real-api
```

If Playwright is not installed in this workspace, supply `PLAYWRIGHT_MODULE` and, when needed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. The existing local runtime paths used in this checkout are supported.

The browser test mounts the real IssuesPage, Team Settings and TriagePage, authenticates using an explicitly seeded test session and forwards `/api` requests to the temporary Nest server. It does **not** mock API response bodies. It covers actual issue creation/editing, sub-issues/dependencies, recurrence, bulk/lifecycle/order, internal form creation/submission and triage accept/decline/duplicate; it checks persisted rows/history across database restart and captures desktop/mobile light/dark screenshots for Issues and Triage.

Fixture sessions are not evidence of live GitHub OAuth. This check does not prove private-team policy, invitation lifecycle, all issue operations or full feature completeness. Those require subsequent milestone-specific acceptance tests.

## Latest evidence

- Latest `pnpm test:workflow-foundation`: 8 tests passed, 0 failed/skipped; 9 dependent build tasks successful. `/tmp/reka-triage-workflow-foundation-final.log`.
- Latest `pnpm type-check`: 18 tasks successful. `/tmp/reka-triage-types-final2.log`.
- Latest `pnpm test:web:real-api`: actual issue + triage UI flows, restart persistence, and Issues/Triage desktop/mobile light/dark captures passed. Logs: `/tmp/reka-triage-browser-final2.log`; screenshots under `/tmp/reka-foundation-real-api-{dark,light}-{1440,390}.png` and `/tmp/reka-triage-{dark,light}-{1440,390}.png`.
- Existing monorepo baseline build remains successful with the known non-blocking web bundle-size warning. No user-facing design replacement was made.

## Remaining work

This foundation note records the original staging constraints, not the current milestone order. Workspace access is implemented and its HTTP/native-DB/browser evidence is tracked in [WORKSPACE_ACCESS.md](WORKSPACE_ACCESS.md) and the matrix. Continue from the active goal's remaining milestones; do not apply staged migrations to the configured parent or deploy without separate authorization.

The mobile issue row is currently very dense and can leave no visible space for a long title. This existing UI limitation was observed during real-API captures; it is tracked for the final preservation/accessibility review rather than silently redesigning the Issues page in a database milestone.
