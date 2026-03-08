#!/bin/sh
set -e

echo "[entrypoint] Aplicando migraciones de base de datos..."
npx prisma migrate deploy --schema ./prisma/schema.prisma

echo "[entrypoint] Migraciones aplicadas. Iniciando servidor..."
exec node dist/index.js
