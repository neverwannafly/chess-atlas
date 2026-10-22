# Extraction worker

Reads brochure PDFs for events in the extraction queue, extracts structured data with the
Antigravity CLI (`agy`, Gemini) and PUTs it to the Chess Atlas API.

Requirements: Node 22, `agy` on PATH (or `AGY_BIN`) and logged in, deps installed in `backend/`
(`pdf-parse@1.x`, `zod`, `tsx`).

## Run locally

```bash
cd backend
npm run dev &                      # API on :8080, ADMIN_TOKEN set in .env
ADMIN_TOKEN=... npx tsx src/extraction/worker.ts --limit 10 --concurrency 3
```

## Against production

```bash
CHESSATLAS_API_URL=https://<your-app> ADMIN_TOKEN=... \
  npx tsx src/extraction/worker.ts --limit 50 --concurrency 3
```

## Flags

`--api`, `--token` (env `CHESSATLAS_API_URL`, `ADMIN_TOKEN`), `--limit 20`, `--concurrency 3`,
`--force` (re-extract everything with a brochure), `--model gemini-3.8-flash-medium`,
`--event <code>`, `--dry-run` (print JSON, no PUT/failure POST), `--out <dir>`
(cache, default `backend/data/extraction-cache/`), `--url <pdf>[,<pdf>]` (extract
URLs directly, implies dry-run; no API needed).

## How it works

download (retries, Google Drive link rewrite, `%PDF` check) -> pdf-parse text -> `agy -p` with
`brochure.schema.json` -> `normalizeExtraction` + zod validation (one repair retry with the zod
errors) -> PUT. Scanned PDFs (text < 200 chars) are copied into the job's temp dir and `agy`
reads/OCRs the file itself (slower, ~2-4 min). Results are cached by PDF sha256 + model + prompt
version in `--out`, so unchanged PDFs never hit the LLM again. Failures POST a short reason to
`/extraction-failure`. Exit code is non-zero only on config errors.

Keep `schema.ts` and `brochure.schema.json` in sync: edit `gen-schema.ts`, then
`npx tsx src/extraction/gen-schema.ts`. Bump `PROMPT_VERSION` in `worker.ts` after prompt changes.
