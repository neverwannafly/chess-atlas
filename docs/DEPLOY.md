# Deploying Chess Atlas on API Frenzy (two services, one deployment group)

Status: prepared, not deployed. The API Frenzy MCP was not authenticated when this was written, so every
platform fact below is UNVERIFIED unless stated.

## Services

Both build from the repo-root `Dockerfile` (context = repo root) with different targets. One process each,
no supervisor script.

| | api | worker |
|---|---|---|
| Build target | `api` (default last stage) | `worker` |
| Command | `node dist/index.js` | `node dist/chessresults/main.js` |
| Replicas | 1 | 1 |
| Port / public | `PORT` (8080), public HTTP | none (no listener) |
| Health check | HTTP GET `/api/health` (image HEALTHCHECK also does this) | none; liveness = process alive. Log line `worker started` on boot |
| Restart policy | always / on failure | always / on failure |
| Volume | mount at `/data` | mount the SAME volume at `/data` |

Local builds: `docker build --target api .` and `docker build --target worker .`.
The worker image has no frontend and no port. `backend/docker/start.sh` was removed (no longer needed).

## Shared SQLite volume

SQLite at `$DATA_DIR/chessatlas.db` (WAL mode). Both services must mount one volume at `DATA_DIR=/data`.
This needs a volume that is shared read-write by two services at the same time on the same host.
Shared volume across services in a group: UNVERIFIED. Also required: both services run on the same node, because
WAL needs shared memory (`-shm`) and does not work over network filesystems (NFS/EFS/SMB).
If the platform cannot do this, fall back (least bad first):
1. One service running both processes (re-add a supervisor like the old `start.sh`, one volume, one replica).
2. Keep two services but move worker writes behind the API (new admin endpoints; code change, not prepared).
Do not use separate volumes per service: the API would never see worker data.

## Environment (names only; defaults from code)

Both services: `DATA_DIR` (`/data` in the image), `NODE_ENV=production` (set in image).

api: `PORT` (8080), `ADMIN_TOKEN` (platform secret, no default; code also accepts `CHESSATLAS_ADMIN_TOKEN`),
`ADMIN_RATE_LIMIT` (120).

worker: `CR_REQUESTS_PER_CYCLE` (300), `CR_MIN_INTERVAL_MS` (3000), `CR_IDENT_PER_CYCLE` (150),
`CR_IDENT_CONCURRENCY` (2), `CR_IDENT_BATCH` (10), `CR_IDENT_BATCH_PAUSE_MS` (20000),
`CR_ARCHIVE_FROM` (2024-01-01), `CR_FETCH_FINISHED_DAYS` (180),
`CHESSRESULTS_USER_AGENT` (built-in default). `ADMIN_TOKEN` only if the extraction worker code path is used.

Secrets: reference `ADMIN_TOKEN` by name from the platform secret store. Never commit values.

## Behaviour notes

- Empty `DATA_DIR`: verified locally; worker runs migrations 1-5, creates `$DATA_DIR/fide`, ingests the FIDE list
  (~212k players) and logs `worker started`.
- After a successful FIDE ingest the downloaded zip is deleted (saves ~51 MB/month). A failed ingest leaves the zip.
- Expected disk: DB plus a transient ~51 MB zip during ingest.
- Start order does not matter; both create the DB and run idempotent migrations. First boot with both services
  starting simultaneously could race on migrations: start the api first, or the worker first, if you can.
- Worker needs outbound HTTPS to chess-results.com and ratings.fide.com: UNVERIFIED.
- Disk persistence across restarts/shutdowns: assumed per owner, UNVERIFIED.

## Owner checklist (all UNVERIFIED)

1. A volume can be mounted by two services in one group at the same time, read-write.
2. Both services land on the same host (needed for SQLite WAL), and the volume is local-disk, not network FS.
3. Volume persists across restarts and shutdowns; size at least 2 GB.
4. Per-service build target/Dockerfile target setting is available (`api`, `worker`); context is repo root.
5. A service can have no port/HTTP health check (worker), and restart policy can be set to always.
6. Replica count can be pinned to 1 for each; no rolling overlap that runs two writers (deploy strategy: stop then start).
7. Outbound internet for the worker.
8. `ADMIN_TOKEN` exists as a platform secret exposed to the api service (existing prod uses `CHESSATLAS_ADMIN_TOKEN`; the code accepts either).
