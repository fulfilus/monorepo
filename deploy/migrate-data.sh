#!/usr/bin/env bash
# Dump local DB and restore it on the server.
# Usage: ./deploy/migrate-data.sh <server-ip>
# Run from repo root on your local machine BEFORE the first deploy.

set -euo pipefail

SERVER_IP="${1:?Usage: $0 <server-ip>}"
DUMP_FILE="fulfilus_$(date +%Y%m%d_%H%M%S).sql"

echo "==> Dumping local database..."
# Reads DATABASE_URL from local .env
source apps/vendor-api/.env 2>/dev/null || true
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set. Export it or add to apps/vendor-api/.env"
  exit 1
fi

pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file="${DUMP_FILE}"

echo "==> Uploading dump to ${SERVER_IP}..."
scp "${DUMP_FILE}" "root@${SERVER_IP}:/root/${DUMP_FILE}"

echo "==> Restoring on server (DB container must be running)..."
ssh "root@${SERVER_IP}" "
  cd /opt/fulfilus
  docker compose exec -T db psql -U fulfilus -d fulfilus < /root/${DUMP_FILE}
  rm /root/${DUMP_FILE}
"

rm "${DUMP_FILE}"
echo "==> Migration complete."
