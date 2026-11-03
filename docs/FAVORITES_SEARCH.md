# Favorites, search and commands

This milestone adds personal favorites and authorized issue/project/document search. It is scoped behavior, not complete Linear parity.

## Favorites

Star an issue from its detail sheet, a project from its detail page, or an accessible document. The collapsible **Favorites** sidebar section links directly to the current user's saved resources. **Workspace → More → Favorites** opens the full list for managing them. These references persist in `user_favorites`; the API resolves each resource under current workspace/team/project permissions on every read. A removed team membership or deleted/archived resource therefore hides its title and ID instead of leaking cached favorite text. Favorite writes are idempotent.

## Search and keyboard actions

Use **Search or jump to…** or **Ctrl/Cmd+K** to search issues, projects and documents. Queries shorter than two characters are not sent. The API accepts a maximum 100-character query, `limit` 1–25 and `offset` 0–1000, returns bounded pages, excludes archived issues/documents, and applies current workspace/private-team/project scope before matching. Document matching covers title and plain-text content. Selecting a result opens the real issue, project or document route; the palette has loading/empty/error/retry and load-more behavior.

Available keys:

- `Ctrl/Cmd+K`: open/close command palette.
- `C`: create an issue.
- `/`: focus the issue-list search field.
- `J` / `K`, arrows, `Enter` / `Space`: navigate/open the focused issue in list/grouped views.
- `G` then `I`, `P`, `D`, `N`, `R`, `S`, `F` or `T`: My Issues, Projects, Documents, Initiatives, Roadmap, Settings, Favorites or Triage.

Text-entry controls, links, buttons, dialogs and menus are excluded from single-key actions so typed letters do not trigger navigation/create commands. No shortcut claims an action that only navigates without executing it.

## Verification

`pnpm test:favorites` runs authenticated Nest HTTP against isolated Postgres and checks bounded search/pagination, same-workspace and private-team results, personal issue/project/document favorites, document search/scope/archive behavior, restart persistence. `pnpm test:web:real-api` drives the browser UI against authenticated Nest HTTP + isolated Postgres for issue/project/document favorites, real search/open, keyboard routes/create, project-document create/edit/archive/restore and database restart persistence. Desktop/mobile light/dark captures were checked for Issues, Favorites, Triage, Milestones and Documents; overflow checks pass. These use controlled session/provider fixtures and do not prove live OAuth or GitHub delivery.

Project/document schema and usage details are in [PROJECTS_DOCUMENTS.md](PROJECTS_DOCUMENTS.md). No migration was applied to the configured parent database, no deployment was made, and no live provider operation was performed.
