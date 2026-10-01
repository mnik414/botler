#!/bin/sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

pids=""

cleanup() {
    echo ""
    echo "Shutting down all services..."

    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   stopping process $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null
        fi
    done

    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                echo "   force-killing process $pid..."
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
    done

    echo "All services stopped"
    exit 0
}

echo "Starting all services..."
echo ""

cd "$BUILD_DIR" || exit 1

ls -lah

# Start the Next.js server
if [ -f "./next-service-dist/server.js" ]; then
    echo "Starting Next.js server..."
    cd next-service-dist/ || exit 1

    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"

    if [ -z "${JWT_SECRET:-}" ]; then
        echo "ERROR: JWT_SECRET is not set; refusing to start in production"
        exit 1
    fi

    if [ -z "${DATABASE_URL:-}" ]; then
        echo "ERROR: DATABASE_URL is not set; refusing to start"
        exit 1
    fi
    echo "Using database: $DATABASE_URL"

    # Apply pending migrations when the Prisma CLI is available
    if [ -f "./node_modules/prisma/build/index.js" ]; then
        echo "Applying database migrations..."
        node ./node_modules/prisma/build/index.js migrate deploy || {
            echo "ERROR: database migration failed"
            exit 1
        }
    fi

    bun server.js &
    NEXT_PID=$!
    pids="$NEXT_PID"

    sleep 1
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
        echo "ERROR: Next.js server failed to start"
        exit 1
    else
        echo "Next.js server started (PID: $NEXT_PID, Port: $PORT)"
    fi

    cd ../
else
    echo "WARNING: Next.js server file not found: ./next-service-dist/server.js"
fi

# Start mini-services (optional)
if [ -f "./mini-services-start.sh" ]; then
    echo "Starting mini-services..."

    sh ./mini-services-start.sh &
    MINI_PID=$!
    pids="$pids $MINI_PID"

    sleep 1
    if ! kill -0 "$MINI_PID" 2>/dev/null; then
        echo "WARNING: mini-services may have failed to start, continuing..."
    else
        echo "mini-services started (PID: $MINI_PID)"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "WARNING: mini-services start script not found, but directory exists"
else
    echo "mini-services directory not found, skipping"
fi

trap cleanup INT TERM

# Caddy runs in the foreground as the main process
echo "Starting Caddy..."
echo "All services started. Press Ctrl+C to stop."
echo ""

exec caddy run --config Caddyfile --adapter caddyfile
