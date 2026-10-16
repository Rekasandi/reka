---
version: 1
slug: "eatures-cycles-components-cycles-page-tsx-33801b1b"
primary_target: "apps/web/src/features/cycles/components/cycles-page.tsx"
related_targets: ["apps/web/src/features/cycles/components/cycle-progress-chart.tsx"]
---

# Cycles timeline

Scope: `/cycles`, including team-scoped sidebar links. Operate mode. The user pinned Screenshot 2026-10-16 at 7.30.50 PM.png and confirmed actual API data, not a mockup. Preserve the app shell, cycle detail route, and authorized lifecycle flows.

## Direction contract

THESIS: A chronological cycle ledger, not cards. A date rail joins compact future/past rows to the expanded current cycle.

OWN-WORLD: Existing Geist, neutral canvas and hairlines. Gray scope, yellow started, violet completed/guide are functional chart colors. Use shadcn Collapsible, Tabs, menus, buttons and ChartContainer with Recharts.

STORY: Scan planned/current/completed cycles, inspect real delivery and capacity, then open the existing detail/planning page. Managers retain create/schedule/end/reopen; viewers only read.

FIRST VIEWPORT: Small Cycles heading/actions, line filters, left month/day markers and vertical rail. Wide rows align name, subdued status, capacity/success and scope. The current row opens into a roughly two-thirds chart / one-third three-row summary. Stack on mobile without horizontal scrolling.

FORM: User-pinned timeline; no concept seed needed. Keyboard-operable collapse is the signature interaction; no entrance animation. No invented cycles, pause records or Started history. Capacity unset is not zero. History requests are lazy for the opened cycle.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish evidence

Inline review substituted because this harness has no subagent tool. Initial disposition: fix. Final verdict: all three listed fixes resolved (320px filter fit, first/last chart date ticks, flat tab/link chrome); disposition: ship at that review scope. The confirmed actual-data adaptation intentionally does not reproduce an unrecorded historical Started area or the screenshot's fixture values.

`cycles-timeline.mjs` passed across 10 width/theme captures; `cycles-real-api.mjs` passed against isolated Nest/Postgres including current category counts, capacity, schedule persistence and rollover; full-app audit passed 39 routes / 156 renders. Changed-target detector returned `[]`. Evidence under `/tmp/reka-cycles-timeline*`.

Documentation updated in `docs/CYCLES.md`, `docs/PANDUAN_REKA.md`, and `docs/UI_UX_IMPROVEMENTS.md`. Documenter checked scoped chart colors, 12/14px Geist body text, inherited heading/buttons, 1px rail/dividers, and responsive composition against the incumbent implementation. No changes to `DESIGN.md` or its sidecar; no unrelated design drift repaired. No shipping raster assets or generated imagery. Existing Vite bundle-size warning remains, without claiming performance/load acceptance.
