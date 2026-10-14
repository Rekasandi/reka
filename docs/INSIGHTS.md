# Insights

Insights is a scoped, historical report surface at `/insights`. It reads persisted issue-history events and cycle snapshots; it does not derive a fictional past from current issue state. The UI uses the existing REKA shadcn/Tailwind system and provides issue and cycle delivery tabs, date/team/project/view filters, timezone selection, paginated completions, and explicit empty/error states.

## Issue trends

`GET /api/insights/overview` accepts `from`, `to` (`YYYY-MM-DD`, inclusive local calendar dates), `timezone` (IANA), optional `teamId`, `projectId`, `viewId`, `page`, and `pageSize` (maximum 50; default 20). The range is limited to 366 days. Local-midnight boundaries are converted using the selected timezone, including DST changes.

- **Throughput** counts each issue's first *recorded* transition into a `completed` workflow category. A later re-completion after an observed completion is shown separately and does not add throughput. For issues with baseline history, an earlier completion before instrumentation may be unknown; the response and UI expose this uncertainty rather than claiming lifetime first completion.
- **Lead time** is recorded creation to first observed completion; **cycle time** is first observed entry into a `started` category to first observed completion. Samples require both timestamps in the history. Missing creation/start history is counted; there is no zero fill or estimate from `issues.created_at`/current status.
- Daily buckets follow the selected timezone. Completion rows are paginated independently of aggregate metrics.
- Saved views apply their persisted priority, assignee, project, label and team filters. Access to a private view/project/team and every referenced filter resource is rechecked server-side. Labels are evaluated from current issue-label assignments because label-assignment history is not currently recorded; other issue properties use the status-history event snapshot.

## Cycle delivery

`GET /api/insights/cycles` accepts the same date/timezone and optional team filters, plus `cycleId` and `unit=issues|estimate`. Project and saved-view filters are rejected: persisted cycle snapshots are cycle-wide and cannot truthfully be filtered to those issue subsets.

- **Velocity** includes completed cycles only when their latest persisted snapshot before the report end falls inside the selected date range. It reports the completed issue count or completed estimate points from that final snapshot and includes missing-estimate counts. Completed cycles with no snapshot are reported as unmeasured and excluded.
- **Burndown** is displayed for an explicitly selected cycle, using recorded snapshot rows only. It reports remaining issues or estimate points and missing estimates. The UI does not interpolate gaps, forecast capacity or backfill before snapshot instrumentation. A cycle with no snapshot has an explicit no-history state.
- Team/private-team authorization is enforced before reading cycles/snapshots; workspace admins are not a bypass for private-team membership.

## History, limits and migration

Migration `0027_insight_status_category_history.sql` adds nullable `before_status_category` and `after_status_category` fields and replaces the issue-history trigger for future writes. Existing rows are preserved with unknown categories; the migration never maps today's workflow configuration onto old records. Future transitions capture the category that applied when each row was recorded. This means duration and throughput coverage grows only from the instrumentation point forward.

Reports fail explicitly when issue history exceeds the 50,000-event response bound. Velocity considers at most the 500 most recently started cycles in scope; the response identifies possible truncation. A selected cycle's burndown returns up to 10,000 recent samples and marks truncation. Completion results remain paginated. These limits avoid silent partial results.

## Verification and files

- API/history: `apps/api/src/insights/`, `apps/api/test/insights.integration.test.cjs`, `apps/api/test/insights-history-migration.integration.test.cjs`.
- Migration/schema: `packages/database/drizzle/0027_insight_status_category_history.sql`, `packages/database/src/schema/issue-history.ts`.
- UI/browser: `apps/web/src/features/insights/`, `apps/web/test/insights-real-api.mjs`.
- Run `pnpm test:insights` for staged migration and isolated Nest/Postgres contracts. With Vite running and an installed Playwright package/runtime, run `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs WEB_URL=http://127.0.0.1:5173 pnpm test:web:insights-real-api` for authenticated browser → real Nest API → isolated PostgreSQL checks plus desktop/mobile light/dark screenshots. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may be set for a custom browser binary.

All recorded verification uses temporary isolated PostgreSQL and controlled fixtures. The configured parent database was not migrated; no deployment or live external action occurred.
