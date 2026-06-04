# syntax=docker/dockerfile:1.7
FROM node:20.11-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY apps/accounting/package.json apps/accounting/
COPY packages packages
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --filter @unified/accounting...

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile --filter @unified/accounting... && \
    pnpm --filter @unified/accounting build

FROM node:20.11-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /repo/apps/accounting/.next/standalone ./
COPY --from=build /repo/apps/accounting/.next/static ./apps/accounting/.next/static
COPY --from=build /repo/apps/accounting/public ./apps/accounting/public
USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/healthz').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/accounting/server.js"]
