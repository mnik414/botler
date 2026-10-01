#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting server..."
exec node server.js
