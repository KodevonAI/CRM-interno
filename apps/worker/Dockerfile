# Build context: repo root  (compose.yml usa context: .)
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache openssl

# ─── 1. Instalar dependencias ────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/worker/package.json    ./apps/worker/
COPY packages/db/package.json    ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --no-frozen-lockfile

# ─── 2. Build ────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generar cliente Prisma
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=true
RUN node_modules/.bin/prisma generate --schema=./packages/db/prisma/schema.prisma
# Compilar TypeScript → dist/
RUN pnpm --filter worker build

# ─── 3. Imagen de producción ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/worker/dist         ./dist
COPY --from=builder /app/apps/worker/package.json ./package.json
COPY --from=builder /app/node_modules             ./node_modules

CMD ["node", "dist/index.js"]
