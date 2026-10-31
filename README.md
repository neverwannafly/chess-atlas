# Chess Atlas

A fast, filterable directory of every AICF-registered chess tournament in India.
Event listings are scraped from [aicf.in/all-events](https://aicf.in/all-events/); prize funds,
time controls, schedules, venues and contacts are extracted from each brochure PDF by an
LLM worker running on [Antigravity](https://antigravity.google) (`agy`).

## Architecture

```
AICF /all-events/ ──scrape (cron 6h)──▶ backend: Express + SQLite (FTS5) ◀──REST── frontend: React SPA
                                             ▲            │
                       PUT extraction JSON   │            │  GET /api/admin/extraction-queue
                                             │            ▼
                                  extraction worker (runs anywhere `agy` is installed)
                                  PDF → text (or OCR for scanned PDFs) → agy --json-schema → zod
```

- One container: the backend serves the built SPA and `/api/*`. See `Dockerfile`.
- The API and data shapes are specified in [`docs/CONTRACT.md`](docs/CONTRACT.md).

```
backend/src/
  db/           migrations + queries (SQLite, WAL, FTS5)
  services/     AICF scraper
  lib/          place (city/state) + date normalisation, ICS, HTTP helpers
  routes/       public + admin API
  extraction/   Antigravity brochure-extraction worker (schema, prompt, pdf, worker)
frontend/src/
  pages/        Discover, Event detail, Stats, 404
  components/   filter bar, cards/list/calendar views, UI primitives
  lib/          typed API client, formatting, URL-backed filters
```

## Development

Requires Node 22+.

```bash
# backend (http://localhost:8080)
cd backend && npm install
ADMIN_TOKEN=dev npm run dev       # migrates DB, scrapes on boot if stale
npm test                          # place/date parsing tests

# frontend (http://localhost:5173, proxies /api → :8080)
cd frontend && npm install && npm run dev
VITE_MOCK=1 npm run dev           # run against built-in fixtures, no backend needed
```

## Brochure extraction

```bash
cd backend
CHESSATLAS_API_URL=http://localhost:8080 ADMIN_TOKEN=dev npm run extract -- --limit 50 --concurrency 4
npm run extract -- --url <pdf-url>    # dry-run a single brochure, prints JSON
```

Results are cached by PDF hash in `backend/data/extraction-cache/`, so re-running against a
different backend (e.g. production) does not re-invoke the model. See
[`backend/src/extraction/README.md`](backend/src/extraction/README.md).

## Chess-results mirror

A separate worker (`backend/src/chessresults/`) keeps a mirror of tournaments on
[chess-results.com](https://chess-results.com/): standings, round-by-round pairings and results.
The operator has agreed to this use. Every page shown from it links back to the source.

```bash
cd backend
CHESSRESULTS_USER_AGENT="ChessAtlasBot/1.0 (contact: <ops email>)" npm run chessresults
```

- Runs every 30 minutes in its own process (it shares the SQLite file with the API).
- Each cycle reads the home page once, then refreshes only tournaments whose "N minutes ago" shows an
  update since our last fetch. Pages are fetched one at a time, at least 3 seconds apart.
- Each cycle has a request budget (`CR_REQUESTS_PER_CYCLE`, default 300). The first run backfills
  everything over several cycles.
- Only names, ratings and clubs are stored. FIDE IDs and dates of birth are never stored.
- API: `GET /api/chessresults/tournaments`, `/tournaments/:id`, `/tournaments/:id/rounds/:round`, `/status`.
- Discovery is limited to the home page (current and recent events). Older tournaments are not discovered yet.

Environment: `CR_MIN_INTERVAL_MS` (default 3000), `CR_REQUESTS_PER_CYCLE` (default 300).
The worker needs to run as a second process in production; the current Dockerfile starts only the API.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `DATA_DIR` | `backend/data` | SQLite location (`/data` in Docker) |
| `ADMIN_TOKEN` | — | Bearer token for `/api/admin/*` (admin routes return 503 when unset) |
| `ADMIN_RATE_LIMIT` | `120` | Admin requests per minute per IP |
