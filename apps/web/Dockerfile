# Web Dockerfile (workspace-aware)
# Build context should be repo root.

FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install

COPY apps/web apps/web
COPY packages/shared packages/shared

WORKDIR /app/apps/web

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

EXPOSE 3000

CMD ["pnpm", "dev"]
