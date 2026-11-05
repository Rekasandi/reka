# API and worker images for the pnpm monorepo. Build one with --target api or --target worker
# (docker compose does this for you). The web app is deployed to Vercel, not here.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@reka/api... --filter=@reka/worker...
# Keep only production dependencies; workspace packages keep their built dist/.
RUN CI=true pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node

FROM runtime AS api
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]

FROM runtime AS worker
WORKDIR /app/apps/worker
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3100/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
