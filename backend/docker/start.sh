#!/bin/sh
# One container, two processes: the API serves /api/* and the SPA; the chess-results worker runs its own
# 30-minute cron. They share one SQLite file on the volume, so both must run in the same container.
# If either process exits, the container exits and the platform restarts it.
set -u

node dist/chessresults/main.js &
WORKER=$!

node dist/index.js &
API=$!

term() { kill -TERM "$WORKER" "$API" 2>/dev/null; wait; exit 0; }
trap term TERM INT

while kill -0 "$WORKER" 2>/dev/null && kill -0 "$API" 2>/dev/null; do
  sleep 5
done
echo "[start] a process exited; stopping container" >&2
kill -TERM "$WORKER" "$API" 2>/dev/null
wait
exit 1
