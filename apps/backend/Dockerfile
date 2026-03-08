# Build context: repo root  (compose.yml usa context: .)
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache wget openssl

# ─── 1. Instalar dependencias ────────────────────────────────
FROM base AS deps
WORKDIR /app
# Copiar manifests de todos los paquetes que necesita el backend
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json  ./apps/backend/
COPY packages/db/package.json   ./packages/db/
COPY packages/shared/package.json ./packages/shared/
# --no-frozen-lockfile para que pnpm descargue los binarios nativos
# correctos para linux-musl (alpine) independiente del SO donde se generó el lock
RUN pnpm install --no-frozen-lockfile --shamefully-hoist

# ─── 2. Build ────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generar cliente Prisma
# PRISMA_GENERATE_SKIP_AUTOINSTALL evita que prisma intente hacer `pnpm add @prisma/client`
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=true
RUN node_modules/.bin/prisma generate --schema=./packages/db/prisma/schema.prisma
# Compilar TypeScript → dist/
RUN pnpm --filter backend build

# ─── 3. Imagen de producción ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget openssl

# Servidor compilado
COPY --from=builder /app/apps/backend/dist         ./dist
COPY --from=builder /app/apps/backend/package.json ./package.json

# Dependencias de runtime (incluye @prisma/client + .prisma/client generado)
COPY --from=builder /app/node_modules              ./node_modules

# Schema + migraciones para prisma db push al arrancar
COPY --from=builder /app/packages/db/prisma        ./prisma

# Entrypoint
COPY apps/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3001
CMD ["./entrypoint.sh"]
