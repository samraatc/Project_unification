# syntax=docker/dockerfile:1.7
FROM node:20.11-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY . .
RUN pnpm install --frozen-lockfile --filter @unified/webhook... && \
    pnpm --filter @unified/webhook build

FROM node:20.11-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/webhook/dist ./dist
COPY --from=build /repo/apps/webhook/package.json ./
COPY --from=build /repo/node_modules ./node_modules
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4100/healthz').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
