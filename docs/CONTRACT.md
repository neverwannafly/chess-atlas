# Chess Atlas — System Contract

Single source of truth shared by the backend, frontend and extraction worker.
TypeScript shapes live in `backend/src/types/event.ts` (frontend keeps an identical
copy in `frontend/src/types/event.ts`). Change both together.

## Architecture

```
AICF /all-events/  ──scrape──▶  backend (Express + SQLite)  ◀──REST──  frontend (React SPA)
                                     ▲        │
                 PUT extraction JSON │        │ GET extraction queue
                                     │        ▼
                          extraction worker (Node CLI)
                          download PDF → text → `agy -p --json-schema` (Antigravity/Gemini)
```

- One deployable: the backend serves the built SPA from `frontend/dist` and `/api/*`.
- One Docker image, built from `Dockerfile` at the repo root. Listens on `PORT` (default 8080).
- SQLite file at `${DATA_DIR:-./data}/chessatlas.db`. `DATA_DIR=/data` in production (persistent volume).
- All dates are `YYYY-MM-DD`. "Today" is computed in `Asia/Kolkata`.
- Money is integer INR (no paise). Unknown = `null`, never `0`.

## Event status

`upcoming` (startDate > today) · `ongoing` (startDate ≤ today ≤ endDate) · `past` (endDate < today).

## Extraction status

`pending` (has brochure, never extracted or brochure URL changed) · `done` · `failed`
(last attempt failed; retried after 24h, max 3 attempts) · `no_brochure`.

## Public API

All JSON responses: `{ "data": ..., "meta"?: ... }`. Errors: `{ "error": { "code", "message" } }` with proper HTTP status.

### `GET /api/events`

| param | type | notes |
|---|---|---|
| `q` | string | FTS5 search over name, city, state, venue, organizer |
| `status` | `upcoming,ongoing,past,all` | comma-list; default `upcoming,ongoing` |
| `state`, `city` | string | comma-list, exact match |
| `timeControl` | `Classical,Rapid,Blitz,Mixed` | comma-list |
| `from`, `to` | date | event overlaps [from, to] |
| `minPrize` | int | totalPrizeInr ≥ |
| `maxFee` | int | entryFeeMinInr ≤ |
| `fideRated` | `true`/`false` | |
| `sort` | `startDate` `-startDate` `prize` `-prize` `fee` `name` | default `startDate` |
| `page`, `pageSize` | int | default 1 / 24, pageSize max 200 |

→ `{ data: EventSummary[], meta: { total, page, pageSize, pageCount } }`

### `GET /api/events/:eventCode` → `{ data: EventDetail }` (404 if missing)

### `GET /api/events/:eventCode/calendar.ics` → `text/calendar` single VEVENT (all-day, end exclusive)

### `GET /api/meta/filters`

→ `{ data: { states: FacetCount[], cities: FacetCount[], timeControls: FacetCount[] } }`
Counts are over upcoming+ongoing events. `FacetCount = { value: string, count: number }`, sorted by count desc.

### `GET /api/meta/stats`

→ `{ data: Stats }` (see types).

### `GET /api/health` → `{ data: { status: "ok", events, lastScrapeAt, version } }`

## Admin API

Header `Authorization: Bearer ${ADMIN_TOKEN}`. If `ADMIN_TOKEN` is unset, admin routes return 503.

- `POST /api/admin/scrape` → runs scraper now → `{ data: { scraped, inserted, updated } }`
- `GET /api/admin/extraction-queue?limit=50&force=false` → `{ data: QueueItem[] }`
  pending + retryable failed events, upcoming/ongoing first, soonest first. `force=true` returns every event with a brochure.
- `PUT /api/admin/events/:eventCode/extraction` body `ExtractionSubmission` → validates `extraction`
  against the schema (zod), stores it, sets status `done`, recomputes denormalized columns + FTS → `{ data: EventDetail }`.
  400 with zod issues on invalid payload.
- `POST /api/admin/events/:eventCode/extraction-failure` body `{ error: string }` → increments attempts, status `failed`.

## Extraction schema

JSON Schema: `backend/src/extraction/brochure.schema.json` (generated/kept in sync with the zod
schema in `backend/src/extraction/schema.ts`). Shape = `BrochureExtraction` in the types file.
The LLM must return `null`/`[]` for anything not in the brochure — never invent values.
