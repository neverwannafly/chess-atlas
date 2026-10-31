# Decisions

Explicit product, data and legal decisions for Chess Atlas. Agents and contributors must follow these
unless the owner changes them here. Each entry says who decided, when, and what is still open.
Anything marked **Open** needs an answer before it is relied on.

Owner: the project owner (s0.alively@gmail.com). Dates are when the owner confirmed the decision.

## Scope

1. **India only.** No other countries or markets, even where the data source covers them.
   Decided 2026-10-31.

## Data sources and permissions

2. **chess-results.com mirror.** Tournaments, standings, pairings and results from chess-results.com are
   mirrored, with a link back to the source on every mirrored page. The operator has agreed to this use by
   email. The owner has the written approval; it is not stored in this repo.
   The site's legal notice restricts reproduction beyond the approved use, so do not widen the mirror
   (for example, full player profiles or bulk export) without new approval.
   Approved 2026-10-31 (owner reports approvals received).

3. **Archive scope.** The India archive search covers tournaments from 2015-01-01 onwards, one 90-day window
   per cycle, walking back from about a week ahead. Decided 2026-10-31.

4. **FIDE ratings: official monthly list only.** Ratings come from FIDE's published monthly rating list
   (`players_list_xml.zip`), filtered to federation IND. The undocumented JSON endpoint
   (`a_chart_data.phtml`) stays disabled. Its terms restrict storing or redisplaying their data without
   written permission.
   **Permission obtained.** The owner confirmed on 2026-10-31 that permission from FIDE to display their
   data has been received. The written approval is held outside this repo.

5. **No live FIDE API calls from user requests.** The backend never calls FIDE per page view.

## Identity and data model

6. **Players are never merged by name.** Player records are linked only by deterministic ids: the FIDE id,
   and the chess-results Ident-Number. Players without either get one record per tournament entry, so
   duplicates are allowed. Records that share an Ident-Number are listed together on the profile as a
   grouping, and the rows are not merged. Decided 2026-10-31 (owner: "don't merge players for now, let
   there be duplicates"). Ident-Number linking added 2026-10-31.

7. **FIDE ids come from the starting-rank table** on each tournament's main page, which chess-results
   already prints for every entry. No extra requests are made for this.

8. **Ident-Number and birth year collected.** The owner approved saving the chess-results Ident-Number, and
   later approved storing date of birth for age categories (2026-10-31). The sources publish only a year:
   the FIDE list's `birthday` field and the player card's "Year of birth" row each give a four-digit year.
   Neither publishes a full date, so we store the birth year only. We never store a full date, and we never
   return the year itself from the API: the API returns only the age category. Age categories follow the
   convention in `backend/src/chessresults/age.ts`, to be confirmed against AICF rules.

9. **Status of tournaments without dates.** A tournament is `ongoing` while the live lists show it, and
   `finished` once it has been absent for 36 hours. When dates are known, status follows the dates.
   Approved 2026-10-31.

## Refresh cadence

10. Ongoing tournaments refresh every 30 minutes until their end date. Upcoming tournaments refresh once
    a day. A finished tournament gets one final pass and then stops, unless the list shows a new update.
    Decided 2026-10-31.

11. The FIDE monthly list is checked daily at 05:00 and ingested once per month.

12. **Pacing for player cards (Ident-Number).** Cards are fetched in batches of 10, with up to 2 requests in
    parallel and each client still spaced by its own minimum interval. The job pauses 20 seconds after each
    batch, and at most 150 cards are fetched per cycle. Any 429 or 503 response stops the job and starts a
    rest: 15 minutes after the first, doubling each time, capped at 2 hours. A rested cycle does no work.
    Approved 2026-10-31.

## Privacy and deletion

13. **Privacy notice and deletion requests.** A public privacy notice is served at `/privacy`. Anyone can
    request deletion at `/privacy/delete`. Requests are stored in the database (`deletion_requests`) and
    decided by an admin through `/api/admin/deletion-requests`. Erasure removes FIDE profiles and ratings,
    and replaces the person's name with an anonymous record. Suppression lists stop the data returning on
    later imports. Decided 2026-10-31.
    **Beta:** the notice says grievance officer details will be published soon. Owner to add them before the
    site leaves beta (decision 13).

14. **Retention.** Requests and erased-person markers are kept so erasure is not undone. Other mirrored
    data is kept while the tournament is listed or archived.

15. **Scope of fetching (confirmed 2026-10-31).** The archive is read from 2024-01-01 (`CR_ARCHIVE_FROM`).
    Finished tournaments are fetched only for 180 days after they end (`CR_FETCH_FINISHED_DAYS`). Older ones
    keep their archive row and are not polled. Player cards are fetched only for players in ongoing,
    upcoming, or recently finished events. Reason: the India archive holds about 9,000 events in one 90-day
    window alone, so a full backfill at the approved pacing would take months and load the source heavily.

16. **Identity is verified from the player card.** A FIDE id or Ident-Number is shown only when it is
    verified: FIDE ids from the official list or the player's card, Ident-Numbers from the card. Values from
    a tournament's starting list are kept as unverified and are not shown until a card confirms them.
    Audit on 2026-10-31: among stored FIDE ids that were not on the FIDE list, 13 of 25 sampled did not
    match the player's card. Among list-matched ids, 25 of 25 matched. The unverified values were cleared
    by migration 6, and their cards are re-queued for verification.

17. **Player results are fetched on request.** Listing pages never fetch player data. Opening a player
    profile queues a background refresh of that player's event cards (newest first, at most 40 events),
    with a 60-second debounce per player. The response shows what is stored at that moment. Results are
    stored in our database, so the site does not depend on chess-results being up.

## Open items

- Grievance officer name and contact, to be published before the site leaves beta (decision 13).
- Confirm the age-category convention in `age.ts` against AICF rules (decision 8).
- Children's data: birth years of minors are stored. Confirm the privacy notice wording and the deletion
  path cover them before the site leaves beta.
