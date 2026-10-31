# Agent instructions for Chess Atlas

Read these before changing code, data or copy:

1. **[docs/DECISIONS.md](docs/DECISIONS.md)** holds the explicit product, data and legal decisions.
   Follow them. Do not change any decision there without the owner.
2. **[docs/CONTRACT.md](docs/CONTRACT.md)** is the API and data contract.
3. **[docs/DESIGN.md](docs/DESIGN.md)** is the UI brief.

Rules that come straight from the decisions:

- India only. Do not add other markets.
- Do not merge players by name. Player records are linked only by FIDE id or chess-results Ident-Number.
- Store birth years only, never full dates (the sources publish years only). Never return a birth year from
  the API; return the age category. Never read or store the card's "Year of birth" beyond that year.
- Keep player-card fetching within the pacing in decision 12.
- Do not call FIDE's undocumented JSON endpoint. Use the official monthly list.
- Keep the chess-results mirror inside the approved use: link back to the source and do not reproduce
  more than the approved views.
- Every personal-data change must keep the privacy notice (`/privacy`) and deletion path working.

Commands: backend `npm test` and `npx tsc --noEmit`; frontend `npm run build`.
