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
   - `SESSION_SECRET` — `openssl rand -hex 32`.
   - `API_DOMAIN=api.example.com` — Caddy gets an HTTPS certificate for it automatically.
   - `WEB_URL=https://<your-vercel-domain>`, `RP_ID=<your-vercel-domain>`, `RP_ORIGIN=https://<your-vercel-domain>`.
   - GitHub: `GITHUB_CALLBACK_URL=https://<your-vercel-domain>/api/auth/github/callback` plus the other `GITHUB_*` values; SMTP values if you send email.
   - `REDIS_*` are ignored: compose sets `REDIS_URL=redis://redis:6379` for the containers.
2. Start everything: `docker compose --profile app up -d --build` (Redis, API, worker, Caddy). Check `https://api.example.com/api/health`.
3. Point the GitHub App webhook at `https://api.example.com/api/integrations/github/webhook` (directly at the API, not through Vercel).
4. Update later with `git pull && docker compose --profile app up -d --build`. Logs: `docker compose logs -f api worker`.

Migrations are never run by the containers; follow the migration gate below.

## Deploy the frontend on Vercel

1. Replace `https://YOUR-API-DOMAIN` in `vercel.json` with your API origin (for example `https://api.example.com`) and commit it.
2. Import the repository in Vercel with the **repository root** as the project root. Install/build/output come from `vercel.json`; set Node.js to 22 in Project Settings. No environment variables are needed — never put secrets in Vite env vars, they ship to the browser.
3. After the first deploy, set the API's `WEB_URL`, `RP_ID`, `RP_ORIGIN` and `GITHUB_CALLBACK_URL` to the Vercel domain (step 1 above) and restart the API (`docker compose --profile app up -d`).

The live unread-count stream (`/api/notifications/unread-count/stream`) also goes through the Vercel rewrite. If Vercel's proxy closes long-lived connections, the browser reconnects on its own and gets the current count straight away.

## Deploy on Render

1. Create a Neon project and copy its **pooled** connection string (`DATABASE_URL`). Ensure it includes SSL parameters.
2. Push this repository to GitHub, then create a Render Blueprint from it using `render.yaml`. Supply `DATABASE_URL` for both API and worker when prompted. Render generates `SESSION_SECRET` and provisions Redis.
3. After Render creates the API, copy its public URL. In `vercel.json`, replace `https://YOUR-API-DOMAIN` with that URL. Redeploy Vercel after the change. The rewrite keeps `/api/*` same-origin for the browser, including session cookies and OAuth redirects.
4. Create a Vercel project from the same repository. Keep the project root at the repository root; `vercel.json` contains the pnpm build command and output directory.
5. Set the API's `WEB_URL` to the Vercel production URL. Set `RP_ID` to the Vercel hostname (without `https://`) and `RP_ORIGIN` to its full HTTPS origin. Redeploy the API after setting these values.
6. **Migration gate:** do not run migrations against an existing/configured parent or production database without explicit owner approval, a verified backup/restore plan, a reviewed migration diff, and a rehearsed copy-data migration test. The configured Neon database was explicitly authorized and migrated through 0027 on 2026-10-14 after a copied-data rehearsal; see [the incident record](docs/DATABASE_MIGRATION_2026-10-14.md) for preservation checks and the temporary backup expiry. This is not authorization for future migrations or deployment. After approval, set `DATABASE_URL` explicitly to the intended target and run from a local checkout:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @reka/database db:migrate
   ```

   Never use `db:push` for an existing/production database; it is only for disposable local development data.

7. If using GitHub integration, configure the GitHub App callback URL as `https://<vercel-domain>/api/auth/github/callback` (through the Vercel rewrite, so the session cookie is set for the frontend domain). Set the GitHub credentials in Render. Point the GitHub App webhook URL directly to the Render API's webhook endpoint.

## Required Render settings

- API + worker: same Neon `DATABASE_URL` and Render-managed `REDIS_URL`.
- API: `WEB_URL`, `RP_ID`, `RP_ORIGIN`, and a generated `SESSION_SECRET` (Blueprint generates one).
- GitHub App variables are only needed for GitHub integration. Put the private key in `GITHUB_PRIVATE_KEY` as a multiline value.

Do not commit `.env` files or paste secrets into Vercel's frontend environment: Vite variables are shipped to the browser.
