#!/bin/sh
set -e

echo "[entrypoint] Aplicando schema a la base de datos..."
# db push: crea tablas si no existen, es idempotente
# --skip-generate: el cliente ya fue generado en el build
node_modules/.bin/prisma db push \
  --schema=./prisma/schema.prisma \
  --skip-generate \
  --accept-data-loss

echo "[entrypoint] DB lista. Iniciando servidor..."
exec node dist/index.js
