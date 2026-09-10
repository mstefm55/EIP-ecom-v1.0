#!/bin/sh
set -eu

upload_root="$(node /app/scripts/resolve_asset_storage.mjs)"

mkdir -p -- "$upload_root"
chown -R node:node -- "$upload_root"

echo "Upload storage initialized: root=$upload_root user=node"

# Temporary deployment closure hook: use the existing schema_migrations ledger
# to apply only migrations that production has not recorded yet. This avoids
# changing Railway's staged environment configuration just to apply 0150.
echo "Applying unapplied EIP migrations before API startup"
gosu node npm run migrate

exec gosu node "$@"
