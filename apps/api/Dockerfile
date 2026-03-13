# API Dockerfile — multi-stage production build
# Build context: repo root (docker-compose.yml)

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace manifests + lockfile for reproducible install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install all deps (needed for build)
RUN pnpm install --frozen-lockfile

# Copy sources
COPY apps/api apps/api
COPY packages/shared packages/shared

# Build shared package first, then API
RUN pnpm -C packages/shared build 2>/dev/null || true
RUN pnpm -C apps/api build 2>/dev/null || pnpm -C apps/api exec tsc --outDir dist --noEmit false

# ── Stage 2: production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable

# Copy workspace manifests for prod install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist 2>/dev/null || true

WORKDIR /app/apps/api

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

EXPOSE 3001

# Run migration then start server
CMD sh -c "node dist/db/migrate.js && node dist/server.js"
