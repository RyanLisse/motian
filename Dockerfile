# RJC-419 — Coolify/Docker standalone Next.js image (no secrets baked in)
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/esco/package.json ./packages/esco/
COPY packages/scrapers/package.json ./packages/scrapers/
COPY extension/package.json ./extension/
# --ignore-scripts: the deps stage carries extension/package.json but not the
# extension's sources, so its `wxt prepare` postinstall aborts the whole install
# with "No entrypoints found in /app/extension/entrypoints" and the image cannot
# be built at all. The web build needs no postinstall, and skipping them also
# keeps arbitrary install scripts and unused browser binaries out of the image.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
# pnpm links each workspace's dependencies into its own node_modules, so
# copying only the root one leaves packages/db unable to resolve
# @neondatabase/serverless and fails the build. The sources land in the
# following COPY; .dockerignore keeps it from clobbering these links.
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/extension/node_modules ./extension/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN SKIP_ENV_VALIDATION=1 pnpm build

FROM base AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  INTERNAL_SERVER_URL=http://127.0.0.1:3001 \
  PORT=3001 \
  HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3001
# Liveness, not readiness. /api/gezondheid runs two Neon queries, so probing it
# every 30s lets a transient database blip fail three checks and restart a
# container whose process is serving fine — turning a short degradation into a
# restart loop. /api/health answers "is this process up?" without touching the
# database; /api/gezondheid itself stays the deep view for operators.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/gezondheid/leeft" || exit 1
CMD ["node", "server.js"]
