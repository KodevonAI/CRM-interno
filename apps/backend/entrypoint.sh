#!/bin/sh
set -e

echo "[entrypoint] Aplicando migraciones de base de datos..."
node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "[entrypoint] Migraciones aplicadas. Iniciando servidor..."
exec node dist/index.js
