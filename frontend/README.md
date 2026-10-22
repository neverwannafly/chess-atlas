# Chess Atlas — frontend

React 19 + Vite + Tailwind v4 + TanStack Query + react-router. The hero board is a Remotion
composition (`src/remotion/HeroGame.tsx`, lazy-loaded via `src/components/HeroBoard.tsx`).

```sh
npm run dev     # proxies /api to localhost:8080
npm run build
npm run lint
VITE_MOCK=1 npm run dev   # fixtures, no backend
```

## Design system

Tokens (colour, type, radii, elevation, motion) live as CSS variables in `src/index.css` and are
exposed to Tailwind through `@theme`. Type is Geist + Geist Mono from Google Fonts. Theme init runs
from `public/theme-init.js` (the CSP forbids inline scripts).

## Third-party assets

Chess pieces in `public/pieces/cburnett/` are the **cburnett** set by Colin M.L. Burnett,
licensed GPLv2+ (also available under CC BY-SA 3.0 / GFDL / BSD on Wikimedia Commons). Files were
taken unmodified from lichess's lila repository (`public/piece/cburnett/`) and are self-hosted.
Attribution appears in the site footer.

The hero replays Aronian–Anand, Wijk aan Zee 2013 (0–1); every move was checked legal with chess.js.
