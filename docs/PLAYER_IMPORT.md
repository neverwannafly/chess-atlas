# Player import

Create or update players and their FIDE history from data prepared elsewhere (for example a local FIDE
profile run). Matching is by FIDE id only, never by name.

- **Endpoint:** `POST /api/admin/players/import` with `Authorization: Bearer <ADMIN_TOKEN>`
- **Body:** `{ "players": [ ... ] }`, at most 500 players per request (the body limit is 2 MB).
- **Player:** `fideId` (5 to 9 digits, required), `name` (required), `federationCode` (3 letters),
  `title`, `sex` (`M` or `F`), `birthYear` (a four-digit year only; never a full date), `identNumber`,
  `ratings`: `[ { "list": "standard" | "rapid" | "blitz", "period": "YYYY-MM", "rating": int or null, "games": int } ]`.
- **Rules:** rating rows from the official monthly list are never overwritten. FIDE ids that were erased
  on request are skipped.
- **Response:** `{ "data": { "created", "updated", "skipped", "ratingRows" } }`. Running the same file twice is safe.

Upload from the local machine:

```bash
ADMIN_TOKEN=... npx tsx src/scripts/upload-players.ts --api https://<host> --file players.json
```

The script sends the file in batches of 500 and stops at the first failed batch.
