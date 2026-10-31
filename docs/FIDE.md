# FIDE ratings integration

## Official API
None. FIDE publishes no documented public API. Checked: ratings.fide.com/download_lists.phtml.

## Official bulk data (recommended for the full Indian player list)
Monthly rating lists (TXT/XML zips, ~13-50 MB, back to 2015), e.g.
`https://ratings.fide.com/download/players_list_xml.zip` (combined std/rapid/blitz, all federations incl. IND, with FIDE ID, name, fed, sex, title, ratings, games, K, birth year).
Filter `country == IND` locally. Updated monthly (Oct 2026 list dated 30 Oct).

## JSON endpoint used by the site itself (unofficial, no login)
`GET https://ratings.fide.com/a_chart_data.phtml?event=<FIDE_ID>&period=1`
Needs `X-Requested-With: XMLHttpRequest` and a profile `Referer` (otherwise empty body). `period=0` returned an empty body; `period=1` returned the current-year monthly series (only value verified; other values untested). Response begins with a UTF-8 BOM.

Example (anonymised, values illustrative):
```json
[{"date_2":"2026-Jan","id_number":"5000000","rating":"2000","period_games":"0",
  "rapid_rtng":"1950","rapid_games":"9","blitz_rtng":"1900","blitz_games":"4",
  "name":"Surname, Given","country":"IND"}]
```
Unrated shows as "0" or empty (mapped to null). `period_games` is standard games.

## NOT available as JSON
- Player profile (title, K-factor, sex, birth year, world/national rank): only in the HTML profile page (not used).
- Federation/country listing: none. `incl_search_l.php` returns HTML fragments (not used).
- Client `getPlayerProfile` is therefore derived from history (ratings, name, federation only; title/K/sex/birthYear are null). Use the monthly list for those fields. Never store date of birth.

## Limits and terms
No documented rate limit, caching guidance or API terms. Site footer: "No part of this site may be reproduced, stored in a retrieval system or transmitted ... without written permission from FIDE." Storing and redisplaying data (especially bulk) therefore needs FIDE's permission; get it before production use. Client is polite: UA `ChessAtlasBot/1.0 (India chess directory)`, 2s gap, backoff on 429/5xx, 20s timeout. Cache per rating period (monthly).

## Code
`backend/src/fide/` - `client.ts` (FideClient, getPlayerRatingHistory, getPlayerProfile), `parse.ts`, `parse.test.ts`.
