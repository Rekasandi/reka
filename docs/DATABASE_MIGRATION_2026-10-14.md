# Authorized database migration — 2026-10-14

## Incident and approval

`GET /api/auth/github` returned HTTP 500 (`NeonDbError`) because the running code required `oauth_login_attempts`, but the configured database had only migrations 0000–0003 applied. Vite also logged `ECONNREFUSED` while the API was not listening; direct API and Vite proxy checks later confirmed transport was working.

The user explicitly selected **Migrate configured database** for this standalone bug fix. This did not resume or complete the unfocused workflow goal, and did not authorize deployment or GitHub App/repository writes.

## Target and safety checks

- Configured `.env` target was matched to Neon project `autumn-paper-98906034`, branch `production` (`br-sparkling-wildflower-b3sdhqne`), database and role, without printing connection secrets or changing environment files.
- Read-only preflight found one workspace, three users, one existing owner, 24 issues and four projects. No owner inference/bootstrap was needed.
- Pre-migration copy-on-write backup: `reka-before-login-migration-20261014` (`br-rapid-mud-b3nii08c`), no compute, expiry **2026-10-21T11:37:07Z**. The backup retains the old schema/data; it is not a permanent archive.
- A separate expiring child rehearsed all pending checked-in Drizzle migrations using a direct connection. Every original column and row across 28 existing tables was compared before/after; existing membership rows were preserved while missing legacy memberships could be added by the documented migration.
- The rehearsal passed, then the same 24 pending migrations (0004–0027) were applied to the approved configured database through the Drizzle migrator. Migration journal is now **28/28**. Original-column/row preservation checks passed on the configured database as well; canonical owner membership and the OAuth state table exist.
- The rehearsal branch was deleted; temporary connection credential files were removed. The backup remains until the expiry above. `.env`, `.env.local`, `.neon`, application code and worker configuration were not changed; no deployment occurred.

## Verification

Against the already-running Nest API:

- `GET http://127.0.0.1:3000/api/auth/github` → **302** to GitHub's OAuth authorize endpoint with a state nonce and HTTP-only browser-state cookie. The redirect was not followed; no live GitHub login is claimed by this incident check.
- Anonymous `GET http://127.0.0.1:3000/api/auth/me` → **401** (expected).
- Anonymous `GET http://localhost:5173/api/auth/me` through Vite → **401** (expected), not a proxy connection error.

## Rollback boundary

The retained backup can be selected as the source for a separately authorized Neon branch restore before its expiry. Restoring the configured branch would discard subsequent changes, so first stop writers, preserve the current state, and obtain explicit approval. Do not restore automatically or point the new application code at the old backup schema. No rollback was performed.

Earlier workflow documentation stating that the parent was unmigrated describes the status before this explicit approval; this incident record supersedes that database-status statement only, not its unverified live-provider acceptance rows.
