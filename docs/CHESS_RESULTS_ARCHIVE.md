# Chess-results India archive discovery

Implementation: `backend/src/chessresults/archive.ts` (`fetchIndiaArchive`).

## Which page
`TurnierDB.aspx` is only a landing page (no form). The real search form is
`https://chess-results.com/turniersuche.aspx?lan=1`.

## Request sequence
1. `GET turniersuche.aspx?lan=1` -> 302 to a node host (e.g. `https://s3.chess-results.com/turniersuche.aspx?lan=1&SNode=S0`).
   Read the final URL; POST must go to that same host, otherwise the redirect turns the POST into a GET and the
   form is silently ignored (page comes back with defaults and no results).
2. Parse hidden inputs `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` and the form `action`.
3. `POST` (urlencoded) to the form action with the hidden fields plus:
   `ctl00$P1$combo_land=IND`, `combo_art=5` (all), `combo_sort=4` (end date), `combo_bedenkzeit=0`,
   `combo_anzahl_zeilen=5` (2000, the max), `txt_von_tag=YYYY-MM-DD`, `txt_bis_tag=YYYY-MM-DD`
   ("tournament end between", ISO works), `cb_suchen=Search`. No cookies needed.
4. The response is the form plus one `table.CRs2` of results. The new ViewState in it can be echoed for the next
   POST, so one GET serves a whole run.

## Result table
Columns (found by header text): `Tournament` (link `tnr<ID>.aspx`), FED, `Last update`, `from`, `to`
(`yyyy/mm/dd`), organizer/arbiters, `Location`, `Time control`, `State` ("English / local script"), `Rd.`, `n`
(players), `dbkey`, `EventID`. There is no status column; `finished` is derived as end date < today.

## Limits
- No pager. Output is capped at 2000 rows and the page then says "The output is limited to 2000 lines."
  A single October 2026 month hit the cap (~3000 IND rows), so the client bisects the date window until each
  query is under the cap (a single day over the cap is split by tournament type `combo_art` 0..3, else it throws).
- A zero-result window returns the form with no table; it is detected by the echoed country selection.
- Politeness: all requests go through `CrClient` (serial, >= 3 s apart, stop on 403/429).
