#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${NEXTJS_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}/mini-services"
DIST_DIR="/tmp/build_fullstack_${BUILD_ID:-default}/mini-services-dist"

main() {
    echo "Building all mini-services..."

    if [ ! -d "$ROOT_DIR" ]; then
        echo "Directory $ROOT_DIR does not exist, skipping build"
        return
    fi

    mkdir -p "$DIST_DIR"

    success_count=0
    fail_count=0

    for dir in "$ROOT_DIR"/*; do
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")

            entry_path=""
            for entry in "src/index.ts" "index.ts" "src/index.js" "index.js"; do
                if [ -f "$dir/$entry" ]; then
                    entry_path="$dir/$entry"
                    break
                fi
            done

            if [ -z "$entry_path" ]; then
                echo "Skipping $project_name: no entry file (index.ts/js) found"
                continue
            fi

            echo ""
            echo "Building: $project_name..."

            output_file="$DIST_DIR/mini-service-$project_name.js"

            if bun build "$entry_path" \
                --outfile "$output_file" \
                --target bun \
                --minify; then
                echo "$project_name built -> $output_file"
                success_count=$((success_count + 1))
            else
                echo "$project_name build FAILED"
                fail_count=$((fail_count + 1))
            fi
        fi
    done

    if [ -f "$SCRIPT_DIR/mini-services-start.sh" ]; then
        cp "$SCRIPT_DIR/mini-services-start.sh" "$DIST_DIR/mini-services-start.sh"
        chmod +x "$DIST_DIR/mini-services-start.sh"
    fi

    echo ""
    echo "Build finished."
    echo "Succeeded: $success_count"
    if [ $fail_count -gt 0 ]; then
        echo "Failed: $fail_count"
    fi
}

main
