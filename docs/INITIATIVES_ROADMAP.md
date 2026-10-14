# Initiatives and roadmap

Initiatives and the cross-project roadmap are a measured planning surface, not a simulated forecast. See [LINEAR_WORKFLOW_MATRIX.md](LINEAR_WORKFLOW_MATRIX.md), rows R01–R02.

## Use

Open **Initiatives** to create an objective with optional description, status (`planned`, `in_progress`, `completed`, `canceled`), health (`on_track`, `at_risk`, `off_track`) and optional start/target dates. An initiative groups projects; it does not copy issues, dates, or progress. On its detail page you can edit objective metadata and link/unlink projects. **Roadmap** displays initiatives, projects, milestone dates and project dependency edges using the saved records.

Progress is a weighted rollup from currently visible, non-archived issues across linked projects. It uses each team's configured status categories, excludes canceled work, and counts only projects/issues the current user can read. A viewer with access to an initiative but not one of its private-team projects receives neither that project name nor a count/progress contribution for it. Project dependencies are included only when both endpoints are readable. The service enforces these filters before sending API responses; UI visibility is not the permission boundary.

A project/initiative appears as a timeline range only when both start and target dates exist. A milestone with a target date appears as a point. Incomplete date ranges and undated milestones are listed as **Unscheduled** with the missing date identified; the chart does not invent a start date, duration, or historical progress. On narrow screens, swipe the date grid horizontally; the initiative list uses a compact mobile layout.

## Permissions and data

Any active workspace writer can create an initiative. Its owner or a workspace owner/admin can edit its metadata or delete it. Project associations require the caller to have project-manager rights for that project (project lead/owner, team lead, or workspace administrator, with the existing private-team checks). Workspace members can read the initiative, but linked projects, issue rollups and roadmap edges are filtered by current project/team access. Guest/client legacy roles remain read-only.

API routes are `GET/POST /api/initiatives`, `GET/PATCH/DELETE /api/initiatives/:id`, `POST/DELETE /api/initiatives/:id/projects/:projectId`, and `GET /api/initiatives/roadmap`. Migration `0021_messy_starjammers.sql` adds the initiative and project-association tables and indexes without altering existing project/issue records. It was applied in the isolated migration-preservation test only. **The configured parent database has not been migrated; no deployment was performed.**

No additional provider credentials, paid service or live external write is required. Existing Postgres/API configuration remains the only persistence dependency.

## Verification

```sh
pnpm test:initiatives
pnpm test:web:real-api
pnpm --filter @reka/api type-check
pnpm --filter @reka/web type-check
```

`pnpm test:initiatives` runs authenticated real Nest HTTP over isolated Postgres. It checks issue-derived progress, workspace/private-team filtering (including names, counts and dependency edges), invalid date ranges, owner/member permissions, CRUD/link persistence and an additive migration over a populated project database. `pnpm test:web:real-api` drives the actual React pages through Nest HTTP into isolated Postgres for initiative creation/editing, dates, project grouping, progress, roadmap dates/dependencies and restart persistence. Desktop/mobile light/dark screenshots: `/tmp/reka-initiatives-{light,dark}-{1440,390}.png`, `/tmp/reka-roadmap-{light,dark}-{1440,390}.png`; overflow checks passed. Tests use controlled user/session fixtures and do not imply live OAuth/GitHub behavior.
