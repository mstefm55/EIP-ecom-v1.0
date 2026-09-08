#!/bin/sh
set -eu

upload_root="$(node /app/scripts/resolve_asset_storage.mjs)"

mkdir -p -- "$upload_root"
chown -R node:node -- "$upload_root"

echo "Upload storage initialized: root=$upload_root user=node"
exec gosu node "$@"
