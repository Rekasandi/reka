# Authentication and workspaces

REKA signs people in with [Better Auth](https://www.better-auth.com), running inside the Nest API on REKA's own tables (`users`, `sessions`, `accounts`, `verifications`, `organizations`, `organization_members`, `workspace_invitations`). The model follows Linear: anyone can create an account, a person can belong to several workspaces, and each session works in one *active* workspace.

## Sign-in methods

- **Email + password.** Sign-up sends a verification email; the account cannot sign in until the address is verified (the link also signs the person in). Password reset is by emailed link.
- **Magic link.** A one-time sign-in link (15 minutes). A new email address becomes a new account.
- **GitHub.** OAuth with `read:user user:email repo`. A GitHub login with the same verified email joins the existing account; the GitHub token is stored on the linked account and used for repository/PR features. `users.github_id/github_username` are kept in sync.

All endpoints live under `/api/auth/*` (Better Auth) plus REKA's `GET /api/auth/me`, which returns the user and their active workspace (`workspace: null` until they have one). Session cookies are HTTP-only; API clients and tests may send `Authorization: Bearer <session token>` instead.

## Workspaces

- A new account lands on **/onboarding**: accept a pending invitation sent to its email, or create a workspace (name + URL slug) and become its owner.
- **Invitations** are created from Users / Settings → Workspace (`POST /api/auth/organization/invite-member`). REKA emails the link `/accept-invitation/<id>`; the recipient signs in or up with that email and accepts. Admins can cancel pending invitations.
- **Switching**: the sidebar workspace menu lists the user's workspaces; switching calls `organization/set-active` and reloads all data, because every API read and write is scoped to the active workspace (`requireWorkspace` reads it from the request context). Links of the form `/w/<slug>/<path>` open a page in that workspace, switching to it first.
- **Roles** per workspace: `owner`, `admin` (manage members, invitations, settings), `member` (work), `guest` and `client` (read-only). REKA's member management (`PATCH /api/workspace/members/:id`, deactivation, last-owner protection) is unchanged.
- A session created before the user had a workspace adopts their only workspace automatically.

## Configuration

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Signs cookies/tokens. `openssl rand -hex 32`. Required in production. |
| `WEB_URL` | Public origin of the web app; Better Auth's `baseURL` (callbacks and emailed links are built from it). |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app. Callback URL: `<WEB_URL>/api/auth/callback/github` (the web app proxies `/api` to the API). |
| `GITHUB_CALLBACK_URL` | Optional override of that callback URL. |
| `SMTP_*` | Verification, reset, magic-link and invitation emails. Without SMTP the link is written to the API log (development only). |

Rate limiting of the auth endpoints is on in production (Better Auth's built-in limiter).

## Verification

`apps/api/test/auth-flows.integration.test.cjs` runs the flows over real HTTP on an isolated Postgres: sign-up with verification, magic links, invitations, multiple workspaces and switching, bearer sessions, and GitHub with a provider contract fixture. `apps/web/test/workspace-access-real-api.mjs` drives the browser through invite → sign-up by magic link → accept → member view. No live GitHub call is made by the tests.
