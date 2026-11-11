# Deployment

## Services

- **Vercel:** React/Vite frontend (repository root is the project root; build/output are configured in `vercel.json`). `/api/*` is rewritten to the API, so the browser stays same-origin (session cookies, OAuth, SSE); every other path falls back to `index.html` for client-side routes.
- **API + worker + Redis**, either:
  - **Docker Compose on your own server** (`Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile`) — below, or
  - **Render** (`render.yaml`) — see "Deploy on Render".
- **Neon:** PostgreSQL database.

## Local development

```sh
docker compose up -d        # Redis only, on 127.0.0.1:6379 (matches .env.example)
pnpm dev:all                # web + api + worker
```

## Deploy the backend with Docker Compose

Needs a Linux server with Docker, ports 80/443 open, and a DNS `A` record such as `api.example.com` pointing at it.

1. Clone the repository on the server and create `.env` next to `docker-compose.yml` (start from `.env.example`). Production values:
   - `DATABASE_URL` — Neon **pooled** connection string.
   - `BETTER_AUTH_SECRET` — `openssl rand -hex 32` (signs sessions; see `docs/AUTH.md`).
   - `API_DOMAIN=api.example.com` — Caddy gets an HTTPS certificate for it automatically.
   - `WEB_URL=https://<your-vercel-domain>` (sign-in links and OAuth callbacks are built from it).
   - GitHub: register the OAuth callback `https://<your-vercel-domain>/api/auth/callback/github` on the GitHub App and set the `GITHUB_*` values; SMTP values for verification/magic-link/invitation emails.
   - `REDIS_*` are ignored: compose sets `REDIS_URL=redis://redis:6379` for the containers.
2. Start everything: `docker compose --profile app up -d --build` (Redis, API, worker, Caddy). Check `https://api.example.com/api/health`.
3. Point the GitHub App webhook at `https://api.example.com/api/integrations/github/webhook` (directly at the API, not through Vercel).
4. Update later with `git pull && docker compose --profile app up -d --build`. Logs: `docker compose logs -f api worker`.
5. Health: the API answers `GET /api/health`; the worker answers `GET /health` on port 3100 inside its container (200 while Redis is reachable, 503 otherwise). Both are wired as Docker healthchecks, so `docker compose ps` shows `healthy`/`unhealthy`.

Migrations are never run by the containers; follow the migration gate below.

### Automatic deploy from GitHub Actions

Every push to `main` runs the `deploy` job in `.github/workflows/ci.yml` after type-check, build and integration tests pass (browser tests report separately and do not block it). It SSHes into the server, fast-forwards the checkout to `origin/main`, runs `docker compose up -d --build api worker` (the bundled Caddy is not started, because on the current server a separate Caddy already serves ports 80/443 and reaches the API through `docker-compose.override.yml`) and waits until the API container is healthy. It never runs migrations.

Set these repository secrets (Settings → Secrets and variables → Actions); without them the job is skipped with a warning:

- `VPS_HOST`, `VPS_USER` — the server and the SSH user that owns the checkout and can run Docker.
- `VPS_SSH_KEY` — a private key whose public key is in that user's `~/.ssh/authorized_keys` (use a dedicated deploy key).
- `VPS_PORT` (optional, default `22`) and `VPS_APP_DIR` (optional, default `~/reka`).

The server checkout must be able to `git fetch` from GitHub (a read-only deploy key on the repository, or HTTPS for a public repository).

## Deploy the frontend on Vercel

1. Replace `https://YOUR-API-DOMAIN` in `vercel.json` with your API origin (for example `https://api.example.com`) and commit it.
2. Import the repository in Vercel with the **repository root** as the project root. Install/build/output come from `vercel.json`; set Node.js to 22 in Project Settings. No environment variables are needed — never put secrets in Vite env vars, they ship to the browser.
3. After the first deploy, set the API's `WEB_URL` to the Vercel domain (step 1 above) and restart the API (`docker compose --profile app up -d`).

The live unread-count stream (`/api/notifications/unread-count/stream`) also goes through the Vercel rewrite. If Vercel's proxy closes long-lived connections, the browser reconnects on its own and gets the current count straight away.

## Deploy on Render

1. Create a Neon project and copy its **pooled** connection string (`DATABASE_URL`). Ensure it includes SSL parameters.
2. Push this repository to GitHub, then create a Render Blueprint from it using `render.yaml`. Supply `DATABASE_URL` for both API and worker when prompted. Render generates `BETTER_AUTH_SECRET` and provisions Redis.
3. After Render creates the API, copy its public URL. In `vercel.json`, replace `https://YOUR-API-DOMAIN` with that URL. Redeploy Vercel after the change. The rewrite keeps `/api/*` same-origin for the browser, including session cookies and OAuth redirects.
4. Create a Vercel project from the same repository. Keep the project root at the repository root; `vercel.json` contains the pnpm build command and output directory.
5. Set the API's `WEB_URL` to the Vercel production URL. Redeploy the API after setting it.
6. **Migration gate:** do not run migrations against an existing/configured parent or production database without explicit owner approval, a verified backup/restore plan, a reviewed migration diff, and a rehearsed copy-data migration test. The configured Neon database was explicitly authorized and migrated through 0027 on 2026-10-14 after a copied-data rehearsal; see [the incident record](docs/DATABASE_MIGRATION_2026-10-14.md) for preservation checks and the temporary backup expiry. This is not authorization for future migrations or deployment. After approval, set `DATABASE_URL` explicitly to the intended target and run from a local checkout:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @reka/database db:migrate
   ```

   Never use `db:push` for an existing/production database; it is only for disposable local development data.

7. If using GitHub sign-in/integration, configure the GitHub App callback URL as `https://<vercel-domain>/api/auth/callback/github` (through the Vercel rewrite, so the session cookie is set for the frontend domain). Set the GitHub credentials in Render. Point the GitHub App webhook URL directly to the Render API's webhook endpoint.

## Required Render settings

- API + worker: same Neon `DATABASE_URL` and Render-managed `REDIS_URL`.
- API: `WEB_URL` and a generated `BETTER_AUTH_SECRET` (Blueprint generates one).
- GitHub App variables are only needed for GitHub integration. Put the private key in `GITHUB_PRIVATE_KEY` as a multiline value.

Do not commit `.env` files or paste secrets into Vercel's frontend environment: Vite variables are shipped to the browser.
