# Chess Atlas: design brief (v3)

The source of truth for the frontend rebuild. Every agent reads this first.

## Who it's for, and the one job

Indian chess players (and parents of junior players) deciding **which tournament to play next**.
Their questions, in order: *When? Near me? What format? FIDE rated? Can I still register?
What does it cost and what can I win?* Every screen answers those fast, then gets out of the way.

## Feel

Professional, minimal, quietly futuristic. Think Linear, Vercel and Stripe docs, plus a
well-set printed almanac. Calm surfaces, one accent, precise typography, motion that explains
things rather than decorates them. **Rejected before (don't repeat):** loud colour, condensed
display fonts, gimmicky chess ornaments (a–h strips, lettered discs), a hero that eats the
screen, and a plain tile/card grid for listings.

## Non-negotiables

- **Type:** Geist + Geist Mono (already loaded). Numbers (dates, ₹, counts) use tabular figures.
- **Tokens:** use the CSS variables / Tailwind colours in `src/index.css` (`bg`, `surface`,
  `surface-2/3`, `border`, `border-strong`, `fg`, `muted`, `subtle`, `accent`, `accent-soft`,
  `warn`, `danger`, …), the radii `--radius-sm/md/lg`, the shadows `shadow-e1/e2/e3` and the eases
  `--motion-out` / `--motion-in`. Don't hard-code hex in components. Light and dark both must look
  intentional.
- **Motion:** `motion` (motion/react) is installed. Motion means scroll-linked reveals,
  layout animations when results re-filter, shared-element-feeling transitions (View Transitions
  API where supported), and number tickers. Use transform/opacity only and 60fps on mid phones.
  **Everything respects `prefers-reduced-motion`.** No scroll-jacking.
- **Mobile is first-class:** 390px wide, thumb-reachable controls, bottom sheets, no horizontal
  page scroll, 44px touch targets.
- **Remotion goes.** Drop `@remotion/player`/`remotion` and `src/remotion/` (heavy, and the
  "single chess game playing" hero is what the user disliked).
- Real chess piece art lives in `public/pieces/cburnett/` if needed. Use it sparingly.

## Information architecture

| Route | Purpose |
|---|---|
| `/` | Compact hero, then the listing with filters (the product) |
| `/events/:eventCode` | Dedicated tournament page: everything from the brochure, organised |
| `/insights` | Rich insights: charts, maps, trends (`/stats` redirects here) |

Clicking a listing row **navigates to the event page**: no drawer, and the URL is shareable.
Back returns to the same scroll position with the same filters (filters live in the URL).

## Hero (compact)

At most ~45vh on desktop and ~55vh on mobile, and it collapses as you scroll: the search docks
into the sticky header. One sharp headline, one line of copy, 2–3 live figures (ticker
animation), and the search field. Visual: an **"atlas"**, a minimal dot-matrix India map
where lit dots are tournament cities (ongoing ones pulse softly). It's on brand, it's real
data, and it isn't a chess game. Keep it monochrome and accent-tinted.

## Listing (the hero of the product)

An **agenda/almanac timeline**, not tiles. Group by time: *Happening now · This week · Next week
· Later in {Month}* then by month. Section headers stick. Each row is one horizontal line of
decision facts, aligned in columns on desktop:
date block (big day numeral + weekday/month, multi-day span) · name + city/state · format chip
(Classical/Rapid/Blitz + rounds + TC like `90+30`) · FIDE badge · prize pool · entry from ·
registration state (`Closes in 3 days` in warn colour, `Closed`). Unknown values are quiet
dashes, never noisy. On mobile, the row stacks into a tight 3-line card-less entry. Rows reveal
with a subtle stagger on first view and animate (layout) when filters change. Keep a calendar
view toggle if it earns its place.

## Filters (must be killer)

- URL-synced and instant (no Apply on desktop), with counts per option, and zero-result options
  dimmed.
- Search: `/` or ⌘K focuses. Matches name/city/venue.
- **Format:** segmented control (All · Classical · Rapid · Blitz).
- **When:** presets (This weekend · Next 7 days · Next 30 days · pick months) + custom range.
- **Where:** state → city multi-select with search. Optional "Near me" (geolocation → nearest
  states/cities first) if cheap.
- **Money:** min prize pool and max entry fee as range sliders with ₹ ticks.
- **Toggles:** FIDE rated, Registration open.
- Active filters show as removable chips with "Clear all". Result count animates.
- **Sort:** Soonest · Biggest prize · Cheapest entry · Name.
- **Mobile:** a sticky compact bar (search + "Filters (3)" button). The bottom sheet has a drag
  handle and sections, and the footer button says "Show 42 tournaments".

API (`GET /api/events`): `q, status, state, city, timeControl, from, to, minPrize, maxFee,
fideRated, sort (startDate|-startDate|prize|-prize|fee|name), page, pageSize`, and
`GET /api/meta/filters` for facet values/counts. See `docs/CONTRACT.md`.

## Event page

The answer to "should I play this, and how do I enter?" A header with name, dates, city,
status, and primary actions (Register / Brochure / Add to calendar / Share), sticky on scroll.
A key-facts strip (format & TC, rounds, FIDE, prize pool, entry from, deadline). Then sections:
Prizes (place ladder plus category prizes), Entry fees, Schedule (timeline), Venue (map
embed/link, accommodation), Eligibility & categories, Organiser/arbiter/contacts (tap to call
or mail). Pages with sparse data (no brochure, or extraction pending) must still look complete
and dignified. Add "More tournaments nearby / same week" at the bottom.

## Verification

Run the app against the local API, which has real extracted data. Screenshot desktop
1440 + mobile 390, light + dark, and check reduced motion. Fix what looks off before calling it
done. `npm run build` and `npm run lint` must pass.
