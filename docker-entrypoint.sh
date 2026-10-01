#!/bin/sh
set -e

if [ -z "$JWT_SECRET" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "[entrypoint] FATAL: JWT_SECRET must be set to at least 32 characters." >&2
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] FATAL: DATABASE_URL is not set." >&2
  exit 1
fi

echo "[entrypoint] applying database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting server..."
exec node server.js
