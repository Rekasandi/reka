# Projects, milestones, updates and documents

This describes the supported REKA project workflow. It is scoped workflow parity, not complete Linear feature parity; for acceptance status see [LINEAR_WORKFLOW_MATRIX.md](LINEAR_WORKFLOW_MATRIX.md), rows P01–P05.

## Project setup and access

Use **Projects** to create and find projects. The existing table/list presentation remains unchanged. A project has a team, lead, status, health, priority and optional start/target dates. The date range is validated on the API. Project leads and authorized workspace admins can manage members, transfer the lead, and update project properties. Public-team projects follow current workspace/team access; private-team project reads and mutations require explicit private-team membership even for workspace admins. Project-level membership is used for notifications/planning, not as a replacement for team authorization.

Projects retain issue membership. Add issues to a project or milestone from the project planning panels; a milestone can be reordered, assigned issues can be moved/unassigned, and progress is calculated from currently visible, non-archived issues. Canceled issues are excluded; completion uses each team's configured status category, not a display-name guess. A dependency points from the dependent project to the project it depends on. Self/circular links and inaccessible projects are rejected; dependency reads are access-filtered.

## Project updates and subscriptions

The **Updates** tab stores authored health notes with author and timestamps. A new update changes project health; editing an older update recomputes health from the latest-created update rather than replacing it with stale health. Project owners and added members are subscribed by default; the new lead is subscribed on transfer. On the Updates tab, a user with project access can subscribe or unsubscribe. Removed project members lose their automatic project-update subscription. A notification is created only for a current subscriber who can still read the project; the update itself remains available in the authorized project feed. Notification delivery does not undo a successfully stored update.

Subscriptions are personal persisted records in `project_update_subscriptions`. Migration `0020_aberrant_kulan_gath.sql` backfills current project leads/members into the table; project creation/member addition/lead transfer maintain subscriptions thereafter. No email or external delivery is implied. Global notification preferences and attachment delivery are tracked under the collaboration milestone.

## Documents and search

The workspace **Documents** route lists accessible documents. Create a workspace-level document as an owner/admin, or a team/project document where you have the corresponding access. Documents have a title and plain-text content, can be edited, archived/restored, and favorited. Project-scoped documents are also listed from that project's Documents panel. Archived documents are excluded from ordinary search/list results until restored. Search and the command palette return matching document titles/content only after workspace/team/project authorization; selecting a result opens the actual document route.

Documents are not a collaborative editor, public link, or file upload. Repository association is an existing separate project integration; GitHub repository/PR behavior and authenticated attachments are tracked in the GitHub and collaboration rows rather than inferred from document persistence.

## Persistence, migration and verification

Schema additions use ordered Drizzle migrations `0019_overconfident_thunderbolts.sql` (scoped documents, project dependencies/updates and milestone ordering) and `0020_aberrant_kulan_gath.sql` (project update subscriptions and owner/member backfill). The existing milestones table and issue-to-milestone links are preserved. Both migrations were exercised against isolated staged Postgres/PGlite fixtures, including a legacy milestone/project/member record. **No migration was applied to the configured parent database**, and no deployment was performed.

Commands exercised for these flows:

```sh
pnpm test:projects-docs
pnpm test:views
pnpm test:web:real-api
pnpm --filter @reka/api type-check
pnpm --filter @reka/web type-check
```

`pnpm test:projects-docs` covers real Nest HTTP + isolated Postgres, persistence/restart, legacy migration preservation, milestone ordering/assignment/rollups, dependency cycles and access, authored project updates, subscribe/unsubscribe and recipient filtering, document scope/search/favorites/archive/restore, and project date/lead/member rules. `pnpm test:web:real-api` covers authenticated browser → Nest HTTP → isolated Postgres for project lifecycle fields, member add/remove, lead transfer, milestone assignment, dependencies, update subscription/posting, document create/edit/favorite/archive/restore/search and restart persistence. It also checks responsive light/dark captures for project milestones and documents. Tests use controlled identity/provider fixtures; they do not prove live email, OAuth or GitHub delivery.
