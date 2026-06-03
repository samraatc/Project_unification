# syntax=docker/dockerfile:1.7
FROM node:20.11-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY . .
RUN pnpm install --frozen-lockfile --filter @unified/worker... && \
    pnpm --filter @unified/worker build

FROM node:20.11-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/worker/dist ./dist
COPY --from=build /repo/apps/worker/package.json ./
COPY --from=build /repo/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
