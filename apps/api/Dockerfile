# API Dockerfile (workspace-aware)
# Build context should be repo root.

FROM node:22-alpine AS base
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Copy workspace manifests first (better caching)
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install deps
RUN pnpm install

# Copy sources
COPY apps/api apps/api
COPY packages/shared packages/shared

WORKDIR /app/apps/api

EXPOSE 3001

# Simple prod-ish start (tsx for now; later: tsc build + node dist)
CMD ["pnpm", "dev"]
