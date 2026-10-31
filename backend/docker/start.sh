#!/bin/sh
# Runs the API and the chess-results worker in one container.
# The worker schedules itself every 30 minutes (node-cron); if either process exits, the container exits
# so the platform restarts it.
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
