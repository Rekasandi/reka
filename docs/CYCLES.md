# Cycle planning and delivery history

REKA's cycle implementation covers team scheduling, explicit estimate capacity, unfinished-work rollover and measured delivery history. It is workflow parity for the agreed scope, not a claim to match every Linear cycle feature.

## Cycle timeline

Opening **Cycles** shows a date rail with newest scheduled cycles first. The current cycle opens automatically; click a row or use Enter/Space to expand or collapse its chart. The nearest future cycle per team is **Upcoming**; later future cycles are **Planned**. **Cycle break** is a real gap of at least 24 hours between adjacent same-team cycles, not an invented pause setting.

The shadcn/Radix collapsible rows show current issue scope, estimate-point capacity utilization (or current completion percentage on completed cycles), and a shadcn `ChartContainer` / Recharts progress chart. **All / Current / Upcoming / Completed** preserve the team URL filter and support reload/back/forward. Tab arrows move focus; Enter/Space activates. **Open cycle details** and the row menu retain the existing issue planning/detail route. Managers retain schedule/create/end/reopen; read-only users do not receive lifecycle controls. Server authorization remains authoritative.

Chart history fetches only when a cycle is expanded. Scope and completed issue counts use recorded snapshots; an active cycle also shows current API counts at the current observation time. **Started** counts current issues in the team's actual `started` workflow category; the API does not record Started history, so there is no fabricated yellow historical area. Unknown/missing data is explicit. The dashed completion line is a labeled schedule guide, not measured history or a velocity forecast. Hatching marks local-calendar weekends. The summary stacks below the chart on narrow screens.

Capacity is calculated from planned estimate points, never issue count. Unset capacity is **No capacity set**, not 0%; explicit zero with positive planned work is **Over capacity**, avoiding an infinite percentage. Completed percentages describe the current API scope, not a reconstructed historical close-time scope.

## Schedule a team

Use **Cycles → Schedule settings** and select a team. Configure:

- An IANA timezone (for example `America/Los_Angeles`).
- A duration of 1–90 calendar days and a cooldown of 0–90 calendar days.
- The next local-calendar start date and whether the worker should create cycles automatically.

Settings are shared in Postgres and can only be changed by a team manager. A worker run checks due teams each minute. Each generated cycle uses local midnight as its start and the last millisecond before the day after its duration as its end. The schedule advances by duration plus cooldown, preserving local calendar dates across daylight-saving changes. Settings-row locks, a unique `(team, scheduled start)` key and a single-statement insert/advance make job replay safe. If a planned window overlaps an open cycle, the worker skips creation and advances the date past that cycle and the configured cooldown. Manual creation/editing and reopening are independently checked for overlapping open cycles by a database trigger; date ranges must be non-empty.

Automatic schedule configuration is only effective while the existing worker is running with its normal Redis and database configuration. A schedule is not a substitute for a running worker. Existing cycles receive no invented schedule configuration.

## Estimates and capacity

A cycle may have no capacity or an explicit 0–10,000 estimate-point capacity. Cycle detail shows planned estimate, completed estimate, remaining estimate, capacity remaining/overage, and the number of included issues missing an estimate. Planned/capacity metrics include visible, non-archived issues in `unstarted`, `started` or `completed` workflow categories; missing estimates contribute zero points but remain explicitly counted. `triage`, `backlog` and `canceled` issues do not inflate delivery progress/capacity. Status category—not the display label—drives these rules.

## Complete or reopen a cycle

Completing a cycle is one database operation: it locks the cycle, captures a final measured snapshot, closes it, then rolls eligible issues over. Completed, canceled, triage, backlog and archived issues are left alone. Incomplete `unstarted`/`started` issues can be moved to Backlog (using the team's configured backlog state and clearing the cycle), or to the next later open cycle in the same team (preserving status). An explicit target must be same-team, open and non-overlapping; if no target exists, choose Backlog or create a later cycle first. Repeated close requests are idempotent. Reopening is manager-only, retains prior snapshots, and still obeys the overlap guard.

## Honest history and chart

The worker records one immutable sample for each active cycle per six-hour UTC window. Closing records a final sample. A snapshot contains issue counts and estimate totals at that observation time; archived, triage, backlog and canceled issues are excluded. The chart plots only recorded values and can switch between issue count and estimate points. It does not interpolate a historical curve, backfill before instrumentation, or imply a velocity forecast. A cycle without snapshots shows an explicit no-history state. The timeline additionally distinguishes current observations and its labeled schedule guide from that recorded history; the detail page's measured burndown remains unchanged. Sampling gaps caused by a stopped worker remain gaps in the evidence; starting the worker does not reconstruct them.

## API and access

- `GET/PUT /api/cycles/settings/:teamId` — read/write team scheduling settings.
- `GET /api/cycles`, `GET /api/cycles/:id`, `GET /api/cycles/:id/history` — scoped cycles, current authorized metrics and immutable samples.
- `POST /api/cycles`, `PATCH /api/cycles/:id`, `POST /api/cycles/:id/complete`, `POST /api/cycles/:id/reopen` — manager-authorized planning/lifecycle operations.

Cycle visibility follows workspace and public/private team membership. Workspace administrators do not gain private-team access implicitly. Read access is distinct from write permission. Server authorization is authoritative even when the UI offers a control.

## Migration and verification

Migration `0022_brown_violations.sql` adds nullable cycle capacity/schedule metadata, team schedule settings, immutable snapshots, non-empty date/capacity checks, overlap protection and an atomic close function. It preserves existing cycle rows and does not fabricate settings or delivery history. It was tested against a staged isolated database seeded with a legacy cycle; no configured parent database or production environment was migrated.

Run:

```sh
pnpm test:cycles
pnpm --filter @reka/api type-check
pnpm --filter @reka/worker type-check
pnpm --filter @reka/web type-check
```

The timeline UI regression can be run with `node apps/web/test/cycles-timeline.mjs` (set `PLAYWRIGHT_MODULE` when needed). It covers actual app routes, lazy history, custom workflow categories, capacity/zero/unset, filter scope/history/reload, keyboard collapse, permissions, empty/error/retry, and 10 light/dark viewport captures from 320–2400px.

For authenticated browser → real Nest API → isolated Postgres coverage, start the local Vite app and run `pnpm test:web:cycles-real-api` with `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` set if they are not on the default paths. The browser scenario persists team schedule settings, observes capacity and worker-generated snapshots, completes a cycle and verifies rollover/reload-backed database state; desktop/mobile light/dark captures are checked for horizontal overflow.
