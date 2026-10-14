# Saved views, favorites, search and commands

This milestone adds server-persisted issue views, personal favorites and authorized issue/project/document search. It is scoped behavior, not complete Linear parity.

## Saved issue views

**Workspace → Views** (`/views`) lists and searches accessible saved views. Team **Views** (`/views?teamId=…`) uses the existing authorized API to list that team's views and visible workspace-wide views. Selecting a view opens its Issues route with `viewId`, applying its persisted filter/layout. Opening a workspace-wide view from a team keeps that team's issue scope. Loading, empty/search-empty, and retry states are included.

On **Issues** or a team Issues page, use **Save view** to save the current filter tab, assignee/label/priority/project filters, grouping, sort order, list/grouped/board mode and sub-issue visibility. The default visibility is **Only me**. A view can be linked to the current team or workspace. Workspace owner/admin may publish workspace-wide shared views; team leads and visible workspace administrators may publish a shared team view. Shared views are read-only to others; only the owner or authorized manager may edit/delete. Team-scoped views follow current team visibility and viewer/write access. A team-scoped private view is not visible to non-members, even to a workspace administrator who is not a member of that private team.

View filters are validated at the API boundary. Filter IDs must refer to currently visible people, labels and projects, and team views cannot target another team's projects. When a shared workspace view contains a project/label filter the current user may no longer see, that filter ID is removed from the response. Views are capped at 100 per list response.

Sort options are manual order, recently updated, priority and due date. Grouping currently supports status or none. Saved configurations persist in `saved_views` (`0018_saved_views_favorites.sql`); filters are not a browser-local substitute for shared issue data.

## Favorites

Star an issue from its detail sheet, a project from its detail page, a saved view from the Issues toolbar, or an accessible document. The collapsible **Favorites** sidebar section links directly to the current user's saved resources. **Workspace → More → Favorites** opens the full list for managing them. These references persist in `user_favorites`; the API resolves each resource under current workspace/team/project permissions on every read. A removed team membership or deleted/archived resource therefore hides its title and ID instead of leaking cached favorite text. Favorite writes are idempotent.

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

`pnpm test:views` runs authenticated Nest HTTP against isolated Postgres and checks bounded search/pagination, same-workspace and private-team results, shared/private view authorization and editing, filter-ID redaction after access revocation, personal issue/project/view/document favorites, document search/scope/archive behavior, restart persistence, and staged non-destructive migration `0018` preservation. `pnpm test:web:real-api` drives the browser UI against authenticated Nest HTTP + isolated Postgres for saving/applying/favoriting views, issue/project/document favorites, real search/open, keyboard routes/create, project-document create/edit/archive/restore and database restart persistence. Desktop/mobile light/dark captures were checked for Issues, Favorites, Triage, Milestones and Documents; overflow checks pass. These use controlled session/provider fixtures and do not prove live OAuth or GitHub delivery.

Project/document schema and usage details are in [PROJECTS_DOCUMENTS.md](PROJECTS_DOCUMENTS.md). No migration was applied to the configured parent database, no deployment was made, and no live provider operation was performed.
