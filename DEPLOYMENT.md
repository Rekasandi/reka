# Deployment

## Services

- **Vercel:** React/Vite frontend (repository root is the project root; build/output are configured in `vercel.json`).
- **Render:** NestJS API, BullMQ background worker, and Redis (`render.yaml`).
- **Neon:** PostgreSQL database.

## Deploy

1. Create a Neon project and copy its **pooled** connection string (`DATABASE_URL`). Ensure it includes SSL parameters.
2. Push this repository to GitHub, then create a Render Blueprint from it using `render.yaml`. Supply `DATABASE_URL` for both API and worker when prompted. Render generates `SESSION_SECRET` and provisions Redis.
3. After Render creates the API, copy its public URL. In `vercel.json`, replace `https://YOUR-RENDER-API.onrender.com` with that URL. Redeploy Vercel after the change. The rewrite keeps `/api/*` same-origin for the browser, including session cookies and OAuth redirects.
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
