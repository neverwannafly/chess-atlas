# Chess Atlas: design system

The single source for the visual system. Tokens live in `frontend/src/index.css` and must match this
file; when they differ, fix the code or change this file in the same commit. Product scope and trust
rules are in `docs/PRODUCT.md`; page structure for the calendar is in `docs/DESIGN.md`.

## Principles

1. **Professional.** It should read like a reference work: precise type, aligned numbers, honest labels.
2. **Minimal.** One accent colour. Neutral surfaces. Every element answers a user question or goes.
3. **Quietly futuristic.** Fine borders, soft depth, motion that explains change. Nothing ornamental.
4. **Hierarchy over grids of equal boxes.** Lists and tables always have a lead column (name, date or
   rank) in stronger type, secondary facts in muted type, and numbers right-aligned in tabular figures.
   No plain tables without hierarchy.
5. **Trust is visible.** Every data block carries a source and freshness line (see components).

Never: loud or saturated colour fields, gradients as decoration, condensed display fonts, chess
ornaments (a–h strips, lettered discs), emoji, hero areas taller than 45vh desktop / 55vh mobile.
Real piece art (`/pieces/cburnett/`) is allowed in empty states and small identity marks only.

## Colour tokens

Defined on `:root` (light). Dark values are set on `.dark` on `<html>`, applied before paint by
`public/theme-init.js` from the saved choice or `prefers-color-scheme`. Components use tokens
(Tailwind `bg-surface`, `text-muted`, …), never hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f7f8` | `#0b0d10` | Page background |
| `--surface` | `#ffffff` | `#121519` | Cards, tables, inputs |
| `--surface-2` | `#f0f2f4` | `#181b20` | Hover rows, table heads, segmented track |
| `--surface-3` | `#e6e9ec` | `#20242a` | Pressed, skeleton highlight, progress track |
| `--border` | `#e3e6ea` | `#23272e` | Default 1px border, dividers |
| `--border-strong` | `#cdd2d8` | `#333942` | Inputs, secondary buttons, dashed empty states |
| `--fg` | `#0e1216` | `#eceef1` | Primary text |
| `--fg-muted` | `#4f5964` | `#98a1ac` | Secondary text |
| `--fg-subtle` | `#67707b` | `#7c8591` | Tertiary text, meta, placeholders |
| `--accent` | `#0e7a68` | `#3ccfb2` | Primary action, links on hover, focus, live |
| `--accent-fg` | `#ffffff` | `#04211c` | Text on accent |
| `--accent-soft` | `#e7f3f0` | `rgb(60 207 178 / 0.12)` | Selected and live backgrounds |
| `--warn` / `--warn-soft` | `#a15c07` / `#fdf3e1` | `#f2b04a` / `rgb(242 176 74 / 0.12)` | Deadlines, failed refresh |
| `--danger` / `--danger-soft` | `#b42318` / `#fef3f2` | `#f97066` / `rgb(249 112 102 / 0.1)` | Errors, form validation |

### Status colours

| Status | Text / dot | Background | Treatment |
|---|---|---|---|
| Ongoing (`--status-live`) | `#0e7a68` / `#3ccfb2` | `--accent-soft` | Pulsing dot, label "Live" |
| Upcoming (`--status-upcoming`) | `#2f5b9a` / `#8fb1e6` | `#ebf1fa` / `rgb(143 177 230 / 0.12)` | Hollow ring dot, label "Upcoming" |
| Finished (`--status-finished`) | `#4f5964` / `#98a1ac` | `--surface-2` | No dot, label "Finished" |

Status is never shown by colour alone: the pill always carries its word.

## Typography

Typeface: **Geist** (400, 500, 600) for everything, **Geist Mono** (400, 500) for ids, time controls,
ratings, points and result scores. Loaded from Google Fonts with `display=swap`; fallback
`ui-sans-serif, system-ui`. `font-variant-numeric: tabular-nums` is on for the whole body.

| Token | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 56 / 1.02 | 600 | -0.04em | Home hero headline only |
| `title` | 28 / 1.15 mobile, 36 / 1.12 from 640px | 600 | -0.03em | Page `h1` |
| `h2` | 22 / 1.25 | 600 | -0.02em | Section titles |
| `stat` | 28 / 1 | 500 mono | 0 | Key figures (ratings, counts) |
| `h3` | 17 / 1.35 | 600 | -0.01em | Card and row titles |
| `body-lg` | 17 / 1.6 | 400 | 0 | Lead paragraphs |
| `body` | 15 / 1.55 | 400 | 0 | Default text |
| `ui` | 14 / 1.4 | 500 | 0 | Buttons, nav, table cells |
| `small` | 13 / 1.4 | 400 | 0 | Meta, source lines |
| `label` | 12 / 1.3 | 500 | 0.08em, uppercase | Column heads, eyebrows |

Text measure: 68ch for prose. Never below 12px.

## Spacing and layout

- 4px base unit. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- Content width: max 1200px, centred. Gutters: **16px** below 640px, 24px from 640px, 32px from 1024px.
- Grid: single column on mobile; from 1024px a 12-column grid with 24px gaps, used as main column plus
  a 200–240px side rail on detail pages.
- Vertical rhythm: 48px between page sections (56px from 1024px), 16px between a section title and its
  content, 32px top padding under the header on page heads (48px from 640px).
- Sticky chrome: header 56px. Sticky group headers sit at `top: var(--header-h)`.

## Radii, borders, elevation

- Radii: `--radius-sm` 6px (buttons, inputs, pills), `--radius-md` 10px (cards, tables),
  `--radius-lg` 14px (large panels, sheets), 999px for dots and tags.
- Borders: 1px. `--border` for containers and row dividers, `--border-strong` for interactive edges.
  Empty states use a 1px dashed `--border-strong`.
- Elevation: `e1` `0 1px 2px rgb(14 18 22 / .05)` for cards and tables; `e2`
  `0 8px 24px -8px rgb(14 18 22 / .14)` for popovers and the hero search; `e3`
  `0 24px 64px -16px rgb(14 18 22 / .28)` for sheets and menus. In dark mode depth comes from a
  1px inner top highlight plus darker shadows (values in `index.css`).

## Components

| Component | Spec | States |
|---|---|---|
| Button | 36px (`md`) or 44px (`lg`) high, radius 6px, `ui` text, 16px icon. Primary: accent fill. Secondary: surface, strong border. Ghost: no border. | hover: primary brightness 110%, secondary `surface-2`; focus: ring; active: `surface-3`; disabled: 50% opacity, no pointer |
| Link button | Text in `fg` with a 1px `border-strong` underline at 3px offset; external links add a 14px ↗ icon and an sr-only "(opens in a new tab)". | hover: underline turns `fg`; focus: ring |
| Pill (badge) | 22px high, radius 6px, `small` 500, 6px dot. Tones: live, upcoming, finished, warn, neutral, outline. | static; never clickable |
| Card | `surface`, 1px border, radius 10px, `e1`, padding 20px (24px from 640px). | hover (if linked): border `border-strong` |
| Table | Inside a card. Head row `surface-2` at 60%, `label` style. Rows 44px min, dividers `border` at 70%. Lead column 500 weight; numbers mono, right-aligned. Collapses to two-line rows below 640px. | row hover `surface-2`; top three ranks in accent |
| Tabs / segmented | Track `surface-2` with 1px border, 2px padding; thumb `surface`, border, `e1`, slides with a spring. 32px (36px for round tabs) high. Optional count in `small`. | selected: `fg` text; idle: `muted`; zero-count: 45% opacity; arrow keys move |
| Search field | 36px (header) or 48px (hero), radius 6/10px, leading search icon, clear button when filled, ⌘K hint where the shortcut applies. | focus: border accent + 4px `accent-soft` halo |
| Empty state | Dashed card, centred: optional piece art (48px), `h3` title, `body` muted hint, one secondary action. | — |
| Source / freshness line | `small` muted: "Data: **source** · refreshed 12 minutes ago". Source is a link; time is a `<time>` with the exact IST time on hover. Live pages add "· page re-checks every minute". Failed refresh appends a warn-coloured note. | one per data block |
| Beta badge | Outline pill, `label` uppercase, 20px high, beside the wordmark; links to `/privacy`. | hover: `fg` text |

## Motion

- Durations: 120ms (hover, colour), 200ms (small moves), 320ms (sheets, page hand-off).
- Easing: out `cubic-bezier(0.2, 0.8, 0.2, 1)`, in `cubic-bezier(0.4, 0, 1, 1)`.
- Only `transform` and `opacity`. List entries rise 8px and fade in, staggered 25ms, capped at 10 items.
- The only looping animation is the live pulse (1.6s) on live indicators.
- No scroll-jacking, no parallax, no auto-playing media.
- `prefers-reduced-motion: reduce` turns all animation and transitions off (`MotionConfig` set to
  `user`, and the CSS override in `index.css`).

## Accessibility

- Contrast: body and `muted` text at least 4.5:1 on `bg` and `surface` in both themes; `subtle` at
  least 4.5:1 at 12px and up; UI edges at least 3:1 where they carry meaning (inputs, focus).
- Focus: a visible 2px `accent` outline at 2px offset on every focusable element; never removed
  without a replacement (inputs use the accent border plus halo).
- Keyboard: everything works without a pointer. "Skip to content" link first. `/` and ⌘K focus search.
  Segmented controls and tabs use arrow keys. Escape closes menus and sheets.
- Semantics: one `h1` per page, tables with `caption` and `scope`, `aria-live` for result counts,
  `role="status"` on loaders, `role="alert"` on errors.
- Touch targets: 44px minimum on mobile.

## Mobile

- 16px side gutter at 390px. No horizontal page scroll, ever; only tab strips may scroll inside their
  own container, edge to edge.
- Rows stack into two or three lines instead of shrinking columns. Secondary columns move into the
  second line.
- Primary actions go full width below 640px.
- Sticky header stays 56px; nothing else is sticky except section group headers.
