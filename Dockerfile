# syntax=docker/dockerfile:1.7
#
# Production image for Motian (RJC-419).
#
# Multi-stage so the runtime layer carries only Next's standalone bundle: the
# pnpm store, dev dependencies and the source tree all stay in earlier stages.
#
# Build args vs runtime env, in short:
#   - Nothing secret is needed to BUILD. `SKIP_ENV_VALIDATION=1` turns off the
#     t3-env schema check, which otherwise demands DATABASE_URL at build time
#     and would force a real connection string into the image layers.
#   - Everything secret is supplied at RUN time by Coolify.
# docs/runbooks/container-deployment.md has the full table.

# ---------------------------------------------------------------- base
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
# `packageManager` in package.json pins pnpm; corepack honours it.
RUN corepack enable

# ---------------------------------------------------------------- deps
# Manifests only, so a source-only change does not re-resolve the lockfile.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY extension/package.json ./extension/
COPY packages/db/package.json ./packages/db/
COPY packages/esco/package.json ./packages/esco/
COPY packages/scrapers/package.json ./packages/scrapers/
# `--ignore-scripts`: the web build needs no postinstall. The `extension`
# workspace's `wxt prepare` fails outright here, since the image carries its
# manifest but not its sources, and skipping the rest avoids running arbitrary
# install scripts inside the image and downloading browser binaries nothing
# here uses.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# --------------------------------------------------------------- build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/extension/node_modules ./extension/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Public NEXT_PUBLIC_* values are inlined at build time, so they are build args
# rather than runtime env. They are non-secret by definition.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# No secret reaches the build. Sourcemap upload stays off because
# next.config.ts requires SENTRY_AUTH_TOKEN whenever a DSN is present in a
# production build, and that token must not be baked into an image layer.
ENV SKIP_ENV_VALIDATION=1 \
    NODE_ENV=production
RUN pnpm run build

# -------------------------------------------------------------- runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# wget is busybox's, already present in alpine; used only by HEALTHCHECK.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

# `output: "standalone"` emits a self-contained server.js plus the minimal
# node_modules it actually imports.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Liveness only: /api/health does no database work, so a Neon blip degrades the
# app rather than making Coolify restart a container that is running fine.
# /api/gezondheid remains the deep readiness view for operators.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
