# Issues workflows — usage and verification

Scope and acceptance status: [LINEAR_WORKFLOW_MATRIX.md](LINEAR_WORKFLOW_MATRIX.md), rows I01–I06. This describes the currently staged REKA behavior; it is not a promise of complete Linear parity.

## Team workflow states

Team leads and workspace owner/admins who are members of the team can edit the workflow from **Team → Settings → Workflow**. States have a stable key, display name, category (`triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`), color, order and active flag. The seeded **Triage** state is an internal intake category, separate from personal Inbox notifications. The category—not the display name—drives Active/Backlog/Done filters and issue completion semantics, including project/cycle progress. Built-in statuses remain the fallback for teams without configured states. A state referenced by an issue cannot be removed/deactivated until the work is moved to another state. Status changes are checked against the selected issue's team on the API.

Labels are team/project scoped and can be created in the issue label picker, assigned and unassigned on create/edit. The picker excludes labels from other teams/projects. Team managers can open **Manage labels** from Issues to rename or delete labels; server authorization is team-scoped. Deleting a label removes its assignments but preserves affected issues. The HTTP/Postgres suite verifies manager writes, viewer/non-member denial and private-label scoping; the browser suite renames and deletes an assigned label and confirms the issue remains.

## Triage and internal intake

Buka **Triage** sebagai antrean kerja tim, terpisah dari **Inbox** pribadi. Antrean hanya memuat issue aktif dengan kategori workflow `triage` yang dapat diakses. Layout workbench menampilkan antrean di kiri dan shared issue detail full width/rata kiri, dengan properties sebagai chip horizontal di bawah judul, bukan sidebar kanan. Chip memakai picker existing; estimate disimpan melalui popover, labels menampilkan nama/warna aktual, sementara Type dan Due date tersedia melalui **More properties**. Pada layar sempit chip membungkus dan navigasi bergantian antara antrean/detail; pengguna read-only tetap dapat membaca properti tambahan tanpa mengeditnya. Pilihan eksplisit memakai `?issueId=...` dengan scope `teamId` tetap terjaga, mendukung reload/Back/Forward dan kembali dari full-page issue. Search hanya mencari judul/identifier dalam antrean yang tersedia.

Klik issue, lalu **Accept**, **Decline**, atau **Duplicate** pada toolbar detail. Accept membuka routing ke tim writable, work status aktif, dan assignee yang memenuhi syarat; tim private tetap memerlukan membership eksplisit. Decline meminta alasan opsional dan mengarsipkan intake. Duplicate hanya menampilkan target aktif lain dalam tim yang sama, menautkan provenance dan mengarsipkan sumber. Form pending tidak bisa ditutup/dikirim ulang melalui kontrol UI; kegagalan mempertahankan nilai serta menampilkan inline error. Keberhasilan memperbarui antrean dan memilih intake berikutnya. Keputusan tercatat di activity; API menolak replay pada issue yang sudah diputuskan/diarsipkan. Read-only hanya dapat membaca data yang diizinkan, bukan mengubah properties atau memutuskan intake.

In **Triage → Templates**, a team lead can create/delete a team-scoped internal form; workspace owner/admin can create workspace-wide forms. Forms are not public URLs. They define default issue type/priority and required form fields. A member chooses a form, title and answers; server validation checks required keys, select options and field bounds, then creates a real triage issue. Workspace-wide forms require the submitter to choose a team they can write to. Template visibility follows workspace and private-team membership. A template's triage state cannot be disabled while an active form uses it.

## Issue detail navigation

Desktop list/board clicks open a quick-edit **Sheet**. Choose **Open full page** for a focused issue workspace. Mobile list clicks, Inbox issue links, and command-palette results open `/issues/:id` directly. **Copy issue link** copies this canonical URL; reload and direct access fetch the issue through the authorized API. The Back control returns to the originating list or Inbox, with `/issues` as the direct-entry fallback.

Sheet and page share the same detail content and mutation hooks. The full page places properties in a desktop side column; mobile stacks them below the title. Description, sub-tasks and discussion remain prominent. Attachments, relations, recurrence and GitHub expand on demand. Archive, restore, link-copy and deletion live in **Issue actions**. Deletion confirmations use the existing shadcn AlertDialog; fields, menus, tabs and disclosures use `@reka/ui`. Guest/client and team read-only controls remain disabled; the server remains the authority.

`node apps/web/test/issue-detail-navigation.mjs` verifies the real app router with controlled API fixtures: sheet/page navigation, Inbox, direct entry/reload, browser back/forward, mobile, shared mutations, loading/error states and light/dark layouts. `apps/api/test/issue-detail.integration.test.cjs` checks list/detail label and workflow parity plus private-team denial against disposable Postgres. These checks do not modify production data or verify live providers.

## Issue properties, relations and lifecycle

The create form and issue detail support description, type, priority, nullable assignee, status, labels, estimates (including `0`), due date, project and cycle. API validation prevents invalid estimate/date values, ineligible assignees and cross-team project/cycle/parent/relation links. Recursive sub-issues are same-team; self/circular parent chains are rejected. Directional blocking relations are shown consistently from both ends, `related_to` and `duplicate` are symmetric in reads, and duplicate source provenance is retained.

Issue list context menu **Move to top** persists per-team ordering. In board view, drag an issue card into a status column to change its team-validated status and move it to the top of that column; the accessible **Move to top** card action also supports pointer/keyboard users. List/grouped/board views, status tabs, sidebar facets and bulk status/priority actions operate on authorized issues. Browser acceptance verifies board drop → status/order persistence, list move-to-top, priority sorting, grouping changes, priority filters and saved-view filter/sort/group persistence (matrix I04).

Archive hides issues from the default active list without deleting their history. Restore reverses the matching archive batch only; children archived separately are not restored incidentally. The Archived tab remains available. Bulk actions run through the authorized API; callers should surface partial/batch failures rather than assuming every target changed.

## Recurring issues and worker configuration

Open an issue detail and expand **Recurrence**. Set a positive interval, cadence (`day`, `week`, `month`), IANA timezone, next local occurrence, and optional due-date offset. Saving captures a template snapshot of the source issue and current properties; later source edits do not mutate that snapshot. Each generated occurrence receives normal issue history and links to the recurrence record. Stopping disables future generation; it does not delete previous occurrences.

The Nest worker registers a repeatable recurrence job every 60 seconds. For a deployed/test worker, set `DATABASE_URL` to the same migrated Postgres instance used by the API and configure Redis using `REDIS_URL` (or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`). The API and worker must use the same database and Redis queue. The processor reports failed jobs and uses a stable repeat-job id; database occurrence uniqueness/idempotency prevents duplicates when a due job is retried. Local domain tests call the same processor logic against disposable Postgres and do not need a live Redis service.

Migrations adding issue properties/order/relations, workflow states, recurrence, and triage/forms are `0011_soft_rattler.sql` through `0017_internal_issue_triage.sql` (see the checked-in Drizzle journal for order). **Do not apply them to the configured parent/production database without explicit user authorization.** They were verified only against isolated test databases in this work.

## Repeatable verification

```sh
pnpm test:issues
pnpm test:triage
pnpm test:workflow-foundation
pnpm test:web:real-api
pnpm type-check
pnpm build
```

`pnpm test:issues` runs real HTTP/Postgres and worker/Postgres integration scenarios, including label rename/delete authorization, input validation, properties and label persistence, relations/cycles/provenance, archive/restore, custom-status progress aggregation, recurrence replay, local-time cadence/DST and restart persistence. `pnpm test:triage` runs real Nest HTTP against disposable Postgres; it checks team/workspace template permissions, required/select/unknown-field validation, guest denial, private-team filtering, persisted intake, accept routing/assignment, decline audit, duplicate provenance, replay rejection, and a staged `0017` migration that preserves existing issues/custom states and appends triage after existing states. `pnpm test:web:real-api` runs the real IssuesPage, Team Settings and TriagePage UI against authenticated Nest HTTP and isolated Postgres; it covers custom workflow creation, issue properties, label rename/delete and assignment cleanup, board drop with persisted status/order, list move-to-top, priority sorting/filtering, grouping changes and saved-view filter/sort/group persistence, project/cycle assignment, relations/sub-issues, recurrence configure/stop, bulk status, archive/restore, template creation/submission, accept/routing/assignee selection, decline/duplicate, restart, and desktop/mobile light/dark captures. The checks use controlled session/provider fixtures and do not prove live GitHub OAuth or webhook delivery.

Final evidence from this checkout: `/tmp/reka-issues-label-order-final.log` (4/4, label-manager permission and delete/assignment behavior), `/tmp/reka-final-test-web-real-api.log` (authenticated browser→Nest→isolated Postgres issue/triage/view/project/initiative pass with desktop/mobile light/dark captures), `/tmp/reka-final-test-workspace-access.log` (29/29), `/tmp/reka-final-test-workflow-foundation.log` (8/8), `/tmp/reka-final-test-triage.log` (2/2), `/tmp/reka-final-test-views.log` (2/2), `/tmp/reka-final-test-projects-docs.log` (2/2), `/tmp/reka-final-test-initiatives.log` (2/2), `/tmp/reka-final-test-cycles.log` (3/3), `/tmp/reka-final-test-collaboration.log` (2/2), `/tmp/reka-final-test-github.log` (14/14), `/tmp/reka-final-test-insights.log` (2/2), `/tmp/reka-final-build.log` (10/10 build tasks) and `/tmp/reka-final-types.log` (18/18 type-check tasks). `git diff --check` is clean. Build warns of large Vite chunks (main ~1.86 MB, project-description editor ~800 KB); no migration was applied to the configured parent, no deployment occurred, and no live GitHub operation was performed.
