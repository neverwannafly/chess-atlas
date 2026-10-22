#!/usr/bin/env bash
# Scrape AICF on prod, then extract brochures for new tournaments with agy and upload them.
#
#   TOKEN=... ./sync-prod.sh                 # defaults: --limit 200 --concurrency 3
#   TOKEN=... ./sync-prod.sh --limit 20      # extra args go to the extraction worker
#   API=http://localhost:8090 TOKEN=... ./sync-prod.sh
#
# Only new (pending) events are extracted, plus failed ones older than 24h (max 3 attempts).
# Results are cached by PDF hash in data/extraction-cache, so agy never re-reads a brochure.
set -euo pipefail

API="${API:-https://chess-atlas-dp-s0-alively.apifrenzy.com}"
: "${TOKEN:?set TOKEN to the prod admin token}"

cd "$(dirname "$0")"

# worker needs Node 22; default shell node may be older
NODE22="$HOME/.nvm/versions/node/v22.22.0/bin"
[[ -d "$NODE22" ]] && export PATH="$NODE22:$PATH"
node -e 'process.exit(parseInt(process.versions.node) < 22 ? 1 : 0)' || { echo "need Node 22+ (have $(node -v))" >&2; exit 1; }
command -v agy >/dev/null || { echo "agy not on PATH" >&2; exit 1; }
[[ -d node_modules ]] || npm ci

echo "[$(date '+%F %T')] scraping AICF via $API ..."
curl -fsS --max-time 600 -X POST -H "Authorization: Bearer $TOKEN" "$API/api/admin/scrape"
echo

echo "[$(date '+%F %T')] extracting new brochures ..."
CHESSATLAS_API_URL="$API" ADMIN_TOKEN="$TOKEN" \
  npx tsx src/extraction/worker.ts --limit 200 --concurrency 3 "$@"
