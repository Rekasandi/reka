# API and worker images for the pnpm monorepo. Build one with --target api or --target worker
# (docker compose does this for you). The web app is deployed to Vercel, not here.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm --filter @reka/api... --filter @reka/worker... install --frozen-lockfile \
    && pnpm -r --filter @reka/api... --filter @reka/worker... run build \
    && CI=true pnpm --filter @reka/api... --filter @reka/worker... install --frozen-lockfile --prod --ignore-scripts \
    && rm -rf /root/.local/share/pnpm /root/.cache /tmp/* apps/web packages/ui

FROM build AS runtime
ENV NODE_ENV=production
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
