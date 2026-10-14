# REKA design-system audit

## Source and scope

`DESIGN.md` was read in full and kept unchanged. Its `label-sm` table specifies Geist, 14px, weight 500, 20px line height, and -0.28px tracking; the stray text on the YAML weight line was not needed to make implementation decisions. The audit covers the 16 route entries in `apps/web/src/app/router.tsx`, the shared app shell, and `packages/ui` primitives.

## Routed surfaces reviewed

| Surface | Route(s) | Shared patterns reviewed |
| --- | --- | --- |
| Sign in | `/login` | Geist, semantic primary action, light/dark surface |
| Dashboard | `/dashboard` | shared buttons/badges, semantic chart colors, empty/loading content |
| Inbox | `/inbox` | tabs, filters, buttons, cards, detail panel |
| Issues | `/issues`, `/my-issues`, `/teams/:id/issues` | shared status filters, category pills, list/board controls, sticky desktop filters, mobile sheet |
| Projects | `/projects`, `/projects/:id` | category filters, cards, health/status badges, detail tabs/actions |
| Cycles | `/cycles`, `/cycles/:id` | category filters, status badges, detail controls |
| Teams | `/teams`, `/teams/:id` | cards, tabs, membership and issue actions |
| Users | `/users` | category filters, role controls, badges |
| Clients | `/clients` | industry category pills, cards, form controls |
| Settings | `/settings` | cards, connection/status badges, repository controls |
| Not found | `*` | standalone responsive state and shared actions |

## Shared design-system changes

- Light palette retains `#fafafa` canvas, `#171717` ink, `#ffffff` elevated surface, `#ebebeb` hairline, Vercel blue focus/link signal, and Geist / Geist Mono. Dark mode uses the corresponding semantic tokens and remains the default.
- `Button` provides the existing primary/outline/secondary/ghost/destructive vocabulary plus an `aria-pressed`-aware `category` pill variant. `sm` now follows the 14px button-md type token; icon sizes inherit the app's 6px radius.
- Repeated issue, project, cycle, client, and user filters now use the same shadcn category pill instead of independent raw-button styles.
- `Badge` adds reusable `success` and `warning` variants with semantic, contrast-safe foreground tokens derived from `link-deep`, `link`, and `warning-deep`; project health, active-cycle, connection, and linked-repository states use these shared variants. Success and warning text contrasts are at least 4.74:1 light and 6.24:1 dark. Errors continue to use `destructive`.
- `Input`, `Textarea`, and `SelectTrigger` default to 14px body-md, 6px control radius, hairline border, semantic focus, and disabled/error states. Dense metadata and select fields retain the documented 12px body-sm treatment where the surrounding control group is compact; these are the main remaining explicit type-size overrides.
- Light-mode error text uses the documented `#c50000`; dark-mode `destructive` is adjusted to `#ff4d4d` for readable text contrast against the near-black canvas (6.05:1). Core foreground/background contrast is 17.18:1 light and 16.91:1 dark; muted foreground is 5.50:1 light and 7.66:1 dark.
- Text selection and input/contenteditable caret colors follow the foreground/primary tokens in both the app and shared UI global styles.
- `Card` uses the shared 12px surface radius and hairline, flat elevation; card titles use the documented 600 heading weight.
- Repeated page-header actions, form actions, icon actions, and refresh controls use shared Button size variants rather than repeating height/radius/text-size utilities. A source scan found no ad hoc Button height or text-size classes; the sole deliberate height override is the 48px selectable filter row in `issue-filters-sidebar.tsx`, where the larger touch target is specific to that list.

## Visual verification

Chrome headless captures of the running Vite app were inspected at 1440×1000 in both dark and light themes for `/dashboard`, `/inbox`, `/my-issues`, `/issues`, `/projects`, `/cycles`, `/teams`, `/users`, `/clients`, `/settings`, `/login`, and a wildcard not-found path. Dynamic `/projects/:id`, `/cycles/:id`, `/teams/:id`, and `/teams/:id/issues` routes were also captured in both themes with minimal representative API fixtures. This covers all distinct routed page components (including the `/issues` alias) and confirms the shared shell, surfaces, controls, empty states, detail layouts, and theme contrast; captures verify rendering, not backend behavior.

All 12 top-level routes were also inspected at 390×844 in both themes. The project, cycle, team, and team-issues routes were inspected at that width in light mode. The app shell collapses appropriately, category and action controls remain usable, and no horizontal overflow is visible in the captures. On `/my-issues`, the desktop sidebar is replaced by the Filters trigger; opening it presents the mobile Sheet. The desktop docked sticky panel was toggled closed and reopened.

Top-level authenticated captures intercept API requests with empty JSON responses; detail captures use small in-memory fixtures. These verify layout and representative presentation, not backend behavior. Captures are outside the repository at `/tmp/reka-route-{dark,light}-*.png`, `/tmp/reka-detail-{dark,light}-*.png`, `/tmp/reka-mobile-{dark,light}-*.png`, `/tmp/reka-mobile-light-detail-*.png`, `/tmp/reka-route-light-my-issues-sheet.png`, and `/tmp/reka-route-dark-my-issues-filters-{collapsed,expanded}.png.

## Intentional density and exceptions

- This is an operational product UI, not Vercel's marketing site: 12px `body-sm` remains appropriate for metadata, issue identifiers, counts, keyboard hints, and dense row controls. Layout utilities remain page-specific where the actual information hierarchy differs; repeated control chrome is shared.
- Chart series and integration states retain their domain-specific colors; chart colors are theme-aware, and status colors are not used as decorative chrome.
- The user confirmed that email sign-in and demo-client seeding were intentionally removed. The supported sign-in is GitHub-only; client creation is explicit, with no sample-data seeding. These are intended product behaviors, not design regressions, and were not restored.
- API, worker, and database changes were present in the working tree before this design-system goal began and were not edited as part of it.

## Verification

- `pnpm --filter @reka/web build` — pass (Vite retains the existing >500 kB chunk-size warning).
- `pnpm --filter @reka/ui type-check` — pass.
- Existing issue-filter tests — 3/3 pass via Node's built-in test runner after temporary TypeScript compilation; this package has no Vitest dependency or test script.
- `git diff --check` — pass.

## Subsequent UI cleanup pass

Reading this as a preserve-mode redesign of a software-team product, using the existing Geist, Tailwind and shadcn foundation. `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 6`. Landing-page rules about photography, large heroes, scroll choreography and list avoidance do not apply to this operational app. Routes, primary navigation, GitHub sign-in and existing mutations remain in place.

| Surface | Outcome |
| --- | --- |
| Dashboard | Flat summaries and work sections; neutral horizontal status chart; keyboard-accessible issue rows; explicit loading and issue-error states. Replaced decorative dots and inflated labels. |
| Inbox | Neutral notification icons, functional copy, keyboard row selection and focus, retry state, readable stacked mobile layout, unclipped linked-issue action. |
| Issues, My Issues, Team Issues | Concise descriptions and selected view semantics. Preserved inline properties, hover checkboxes, grouping, board view and mobile filters. |
| Projects | Concise copy and useful empty state. Preserved grouped rows, progress and detail links. |
| Project detail | Reviewed existing overview, borderless description editor, persistent drafts and sticky properties without replacing the reference-based layout. |
| Cycles | One compact list, without duplicate active-cycle cards. Preserved filters, create, end, reopen and detail navigation. |
| Cycle detail | Flat header, non-pulsing shared status badge, count-free category filters and wrapping mobile controls. Planned pace is explicitly an estimate; only one current remaining-work point is plotted. No historical completion data is fabricated. |
| Teams | Compact linked rows with existing icon editing, real counts and creation dialog. |
| Team detail | Flat header and real membership data. Removed fabricated fallback identity and minimum-one-member count. |
| Users | Flat responsive rows, labeled role controls and visible keyboard/touch removal action. Removed redundant editable-role badge. |
| Clients | Lighter summary strip, accurate linked-project label, concise copy and actionable error message. Preserved list, filters and wide detail sheet. |
| Settings | Flat sections and read-only profile text. Removed local-only automation checkboxes and unsupported branch/closed-PR claims. Documented only worker-supported opened/merged PR transitions. Added connection/repository loading and error states. |
| Login | Preserved GitHub-only authentication; error message is announced with `role="alert"`. |
| Not found | Plain explanation and recovery actions, without fake terminal/system diagnostics. |

Reduced-motion preferences apply globally. Semantic issue states, health, priority, unread indicators and integration states retain meaningful colors; ornamental multicolor icons and cycle pulses were removed. Missing comment authors now read “Unknown author,” not a fabricated person.

### Evidence and limitations

- `apps/web/test/all-pages-ui.mjs` renders all 16 routes at desktop/mobile sizes in dark/light modes (64 combinations). It checks runtime errors, horizontal overflow, heading/action clipping, decorative pulses, unsupported Settings controls, dash separators and single-snapshot burndown data.
- Screenshots were visually reviewed in all four theme/viewport combinations. Baseline and updated screenshots/results are under `/tmp/reka-ui-audit-before` and `/tmp/reka-ui-audit-after`.
- Targeted regression scripts cover Clients, Projects, team icon editing, GitHub profiles, inline issue properties and the project detail/editor layout.
- Web production build, shared UI TypeScript check and whitespace check pass. Vite still reports its existing large-chunk warning.
- Browser checks use explicitly fictional API fixtures and do not validate live OAuth, authorization, worker delivery or production Core Web Vitals. No Lighthouse/CWV result is claimed.
