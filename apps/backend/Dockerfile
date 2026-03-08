# Build context: monorepo root
# docker-compose context: ..  dockerfile: apps/backend/Dockerfile

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache wget

# ─── Install dependencies ─────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --filter backend... --filter @kodevon/db --no-frozen-lockfile

# ─── Build ───────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter db generate
RUN pnpm --filter backend build

# ─── Production image ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget

# Servidor compilado
COPY --from=builder /app/apps/backend/dist         ./dist
COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/apps/backend/package.json ./package.json

# Schema + migraciones — necesario para prisma migrate deploy al arrancar
COPY --from=builder /app/packages/db/prisma        ./prisma

# Entrypoint: corre migraciones y luego inicia el servidor
COPY apps/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3001

CMD ["sh", "./entrypoint.sh"]
