#!/bin/bash

# Redirect stderr to stdout so command runners don't treat logs as errors
exec 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Next.js project directory (defaults to the parent of this script; override with NEXTJS_PROJECT_DIR)
NEXTJS_PROJECT_DIR="${NEXTJS_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

if [ ! -d "$NEXTJS_PROJECT_DIR" ]; then
    echo "ERROR: project directory not found: $NEXTJS_PROJECT_DIR"
    exit 1
fi

echo "Starting Next.js + mini-services build..."
echo "Project directory: $NEXTJS_PROJECT_DIR"

cd "$NEXTJS_PROJECT_DIR" || exit 1

export NEXT_TELEMETRY_DISABLED=1

BUILD_DIR="/tmp/build_fullstack_${BUILD_ID:-default}"
echo "Preparing build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "Installing dependencies..."
bun install

echo "Building Next.js app..."
bun run build

# Build mini-services (optional)
if [ -d "$NEXTJS_PROJECT_DIR/mini-services" ]; then
    echo "Building mini-services..."
    sh "$SCRIPT_DIR/mini-services-install.sh"
    sh "$SCRIPT_DIR/mini-services-build.sh"

    echo "  - copying mini-services-start.sh to $BUILD_DIR"
    cp "$SCRIPT_DIR/mini-services-start.sh" "$BUILD_DIR/mini-services-start.sh"
    chmod +x "$BUILD_DIR/mini-services-start.sh"
else
    echo "mini-services directory not found, skipping"
fi

echo "Collecting build artifacts into $BUILD_DIR..."

if [ -d ".next/standalone" ]; then
    echo "  - copying .next/standalone"
    cp -r .next/standalone "$BUILD_DIR/next-service-dist/"
fi

if [ -d ".next/static" ]; then
    echo "  - copying .next/static"
    mkdir -p "$BUILD_DIR/next-service-dist/.next"
    cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
fi

if [ -d "public" ]; then
    echo "  - copying public"
    cp -r public "$BUILD_DIR/next-service-dist/"
fi

# Security note: do NOT package the local dev/test database (it may contain real
# secrets and PII). Production mounts its own database and runs `prisma migrate deploy`.
echo "Skipping local database packaging (production mounts its own database and runs migrations)"

if [ -f "Caddyfile" ]; then
    echo "  - copying Caddyfile"
    cp Caddyfile "$BUILD_DIR/"
else
    echo "Caddyfile not found, skipping"
fi

echo "  - copying start.sh to $BUILD_DIR"
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"

PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo ""
echo "Packaging build artifacts to $PACKAGE_FILE..."
cd "$BUILD_DIR" || exit 1
tar -czf "$PACKAGE_FILE" .
cd - > /dev/null || exit 1

echo ""
echo "Build complete: $PACKAGE_FILE"
echo "Package size:"
ls -lh "$PACKAGE_FILE"
