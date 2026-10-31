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

`:eventCode` accepts the event `slug` (preferred) or the numeric `eventCode`. Every event carries `slug`: unique, lowercase ASCII from the name, e.g. `8th-shaastra-rapid-fide-rated-chess-tournament-2026`.

### `GET /api/events/:eventCode/calendar.ics` → `text/calendar` single VEVENT (all-day, end exclusive)

### `GET /api/meta/filters`

→ `{ data: { states: FacetCount[], cities: FacetCount[], timeControls: FacetCount[] } }`
Counts are over upcoming+ongoing events. `FacetCount = { value: string, count: number }`, sorted by count desc.

### `GET /api/meta/stats`

→ `{ data: Stats }` (see types).

### `GET /api/meta/insights`

→ `{ data: Insights }` (see types). Powers `/insights`. Built in one pass over all events
(`backend/src/db/insights.ts`), cached in memory and rebuilt when the events table changes
(row count or latest `updatedAt`), the IST date rolls over, or after 10 minutes.

- `months`: every start month on record, with counts per format and summed prize pool.
- `days`: every date with a tournament in play (`inPlay`) and how many start that day (`starting`).
- `thisWeek`: today → today+6: starting / ongoing counts, deadlines closing, biggest purse, next 5.
- `upcoming` and `all`: the same `InsightsScope` aggregates over events not yet finished
  (`endDate >= today`) and over everything on record.

Notes on derived numbers: festival sections (Category A/B/C, Rapid/Blitz side events) that quote the
same purse in the same state within 14 days count that purse once. `entryFeeInr` / fee bands use the
regular adult fee from the brochure's fee table, not `entryFeeMinInr` (which is often ₹0 for
titled players). Category-prize kinds are keyword-matched over category/label text.

### `GET /api/health` → `{ data: { status: "ok", events, lastScrapeAt, version } }`

### Chess-results mirror and players (fields used for player links)

Shared rules: a FIDE id (`fideId`, `whiteFideId`, `opponentFideId`, …) is returned only when verified
(decision 16); unverified ids are `null`. A player id is `null` for a removed player (privacy erasure),
and such rows are not linked. A birth year is never returned; only `ageCategory`.

- `GET /api/chessresults/tournaments/:id` → `data.standings[]` carries `playerId` (number or null).
- `GET /api/chessresults/tournaments/:id/rounds/:round` → each game carries `whitePlayerId`,
  `blackPlayerId`, `whiteFed`, `blackFed` besides names, ratings and start numbers.
- `GET /api/players/:id` → `data` adds `club` (from the latest event that lists one), `ageCategory`,
  `identNumber` (card-verified only) and `results[]`: one row per round, newest event first, with
  `tournamentId, tournament, startDate, endDate, snr, round, board, opponentSnr, opponentPlayerId,
  opponentName, opponentFideId, opponentRating, opponentFed, opponentTitle, color ("w"|"b"|null),
  result, fetchedAtMs, source`. `result` is from this player's side: `"1"`, `"½"`, `"0"`, `"+"`/`"-"`
  (forfeit), or null while unplayed. `source` is `"card"` (player card, decision 17) or `"pairings"`
  (derived from stored round pairings when no card has been fetched for that event).
  `meta.refresh = { state, queued, reason, lastRefreshedAt }`: `state` is `"queued"` when this request
  started a background refresh, otherwise `"idle"` (a refresh module may also report `"in_progress"`).
  Clients poll briefly after `"queued"` and stay under the 60 s debounce.

## Admin API

Header `Authorization: Bearer ${ADMIN_TOKEN}`. If `ADMIN_TOKEN` is unset, admin routes return 503.

- `POST /api/admin/scrape` → runs scraper now → `{ data: { scraped, inserted, updated } }`
- `GET /api/admin/extraction-queue?limit=50&force=false` → `{ data: QueueItem[] }`
  pending + retryable failed events, upcoming/ongoing first, soonest first. `force=true` returns every event with a brochure.
  Each item carries `siblings`: other events with the same brochure URL (festival sections), so the
  worker extracts only the item's own section.
- `PUT /api/admin/events/:eventCode/extraction` body `ExtractionSubmission` → validates `extraction`
  against the schema (zod), stores it, sets status `done`, recomputes denormalized columns + FTS → `{ data: EventDetail }`.
  400 with zod issues on invalid payload.
- `POST /api/admin/events/:eventCode/extraction-failure` body `{ error: string }` → increments attempts, status `failed`.

## Extraction schema

JSON Schema: `backend/src/extraction/brochure.schema.json` (generated/kept in sync with the zod
schema in `backend/src/extraction/schema.ts`). Shape = `BrochureExtraction` in the types file.
The LLM must return `null`/`[]` for anything not in the brochure — never invent values.
