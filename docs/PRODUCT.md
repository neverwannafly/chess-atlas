# Chess Atlas: product

Owner: the project owner (s0.alively@gmail.com). Status: **beta**. Read with `docs/DECISIONS.md`
(binding decisions), `docs/DESIGN_SYSTEM.md` (visual system) and `docs/CONTRACT.md` (API).

## What it is

Chess Atlas is an India-only directory and live hub for over-the-board chess. It lists tournaments
across India, follows them while they are played, keeps their results, and shows each player's
ratings and tournament history in one place. It does not host games and does not take entries; it
points people to the organiser, chess-results.com and FIDE for anything official.

## Who it serves

- **Parents of young players.** They plan weekends and travel, compare costs, and need to know
  which age category their child can enter.
- **Players.** They pick the next event, follow their own rounds, and check ratings and results.
- **Organisers.** They want their event found, with correct dates, fees and a link to the brochure.
- **Arbiters.** They check fields, pairings and results across events they are working.

## Core jobs

1. **Find an event I can enter.** When, where, format and time control, FIDE rated or not, entry fee,
   prize fund, and whether registration is still open.
2. **Follow a live event.** Which round is on, how many results are in, the standings now, and a
   direct link to the live boards on chess-results.com.
3. **Check a player's results and ratings.** Latest standard, rapid and blitz ratings from the FIDE
   list, the trend over time, and every mirrored tournament with rank and points.
4. **Know which age category a child fits.** Today this is served by the categories and eligibility
   read from each brochure on the event page (for example Under-9, Under-13). A guided category
   finder is on the "not yet" list.

## Scope now

- India only (decision 1). Other federations are never listed, even where a source covers them.
- Pages: calendar `/`, event page `/events/:code`, insights `/insights`, live `/live`, mirrored
  tournaments `/tournaments` and `/tournaments/:id`, players `/players` and `/players/:id`, privacy
  `/privacy` and deletion request `/privacy/delete`.
- No online play, no user accounts, no payments, no entries taken on the site.
- Beta: the site says so in the header, the footer and the privacy notice.

## Data sources and their limits

| Source | What we use | Limits |
|---|---|---|
| AICF event listings | The national calendar: name, dates, place, brochure link | Updated when organisers update AICF. Brochure fields are summarised automatically and can be wrong; we always say "confirm with the organiser". |
| Organiser brochures (PDF/image) | Prizes, fees, schedule, venue, categories, contacts | Quality varies; some are scans. Missing values stay empty, never guessed. |
| chess-results.com mirror | Tournaments, starting lists, standings, pairings, results (with the operator's approval) | Ongoing events refresh every 30 minutes, upcoming once a day (decision 10). We mirror only the approved views and link back on every page. Live boards stay on chess-results. |
| FIDE monthly rating list | Ratings, titles, rating history for federation IND (with FIDE's permission) | Monthly, so a rating can be up to a month behind. No live FIDE calls from page views (decision 5). |

## Trust rules

1. **Every data block shows its source and freshness**: the source name with a link, and when we last
   refreshed it ("refreshed 12 minutes ago", exact time on hover). If a refresh failed, say so.
2. **Never show unverified ids.** A FIDE id appears only when the starting list printed it or the FIDE
   list matched it. Players are never merged by name (decision 6).
3. **No dates or years of birth**, anywhere, ever (decision 8).
4. **Link out for live boards.** Live and tournament pages always carry the chess-results link; we
   summarise, chess-results is the record.
5. **Unknown stays unknown.** A quiet dash, not a zero or a guess.
6. **Privacy is one click away.** The footer links the notice; deletion works without an account.

## Beta success measures

- **Freshness:** 95% of ongoing tournaments refreshed within 45 minutes; failed refreshes shown, not hidden.
- **Coverage:** at least 60% of upcoming AICF events have a parsed brochure; every live Indian event on
  chess-results appears on `/live` within one refresh cycle.
- **Use:** returning visitors week over week; share of event-page visits that click Register, Brochure or
  chess-results (the page did its job).
- **Accuracy:** organiser or user corrections per 100 events, trending down.
- **Privacy:** every deletion request answered within 30 days; zero incidents of birth data or
  unverified ids shown.
- **Quality bar:** no horizontal scroll at 390px, keyboard reachable, AA contrast on every page.

## Not yet

- Accounts, saved searches, follows or alerts (email, push, WhatsApp).
- A guided age-category finder.
- Organiser self-service (claim or correct a listing).
- Online play, game viewers or PGN downloads; live boards stay on chess-results.
- Merging player records by name, or full player profiles copied from chess-results.
- Markets outside India, other languages, a mobile app.
- Grievance officer details (must be published before the site leaves beta, decision 13).
