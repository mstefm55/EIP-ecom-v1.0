#!/bin/sh
set -eu

upload_root="${ASSET_ROOT:-}"
if [ -z "$upload_root" ]; then
  if [ -d /data ]; then
    upload_root="/data/eip-assets"
  else
    upload_root="/app/assets"
  fi
elif [ "${upload_root#/}" = "$upload_root" ]; then
  upload_root="/app/$upload_root"
fi

case "$upload_root" in
  ""|"/"|"/app"|"/data")
    echo "Invalid upload root: refusing unsafe ownership change" >&2
    exit 1
    ;;
esac

mkdir -p -- "$upload_root"
chown -R node:node -- "$upload_root"

echo "Upload storage initialized: root=$upload_root user=node"
exec gosu node "$@"
