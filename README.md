# Core Keeper Map Tool

Open your Core Keeper map file in the browser and see boss and dungeon rings, biome areas, maze holes and every
ore on your own world. The map is read locally and never uploaded. No ads, no tracking.

Live: https://maptool.ceschmitt.de · Continuation of Craigins' Map Tool.

## Features

- Open `*.mapparts.gzip` by file picker, drag & drop or (installed PWA, Chromium) straight from the OS; one-click
  "continue with last file" and **live updates** while you play (Chrome/Edge).
- Boss, optional boss and dungeon rings for **Standard (1.0+)** and **Classic** worlds, cropped to their biome.
- Automatic **biome sector detection** with a confidence score, or manual rotation.
- **Find tiles**: search ~340 tile types, counts on your map, highlight with dimming, zoomed-out markers, pick a
  tile from the map, list of unknown colours to report.
- **Maze holes** for the Rune Song / Clear Gemstone quests, with a list of candidates.
- **Nearest spot**: jump through ore veins, boulders or any highlighted tile type by distance (N / Shift+N).
- **Pins** per map (right-click → Add pin here), import/export as JSON.
- **Ruler**: measure the distance between two points.
- **Exploration history**: see when areas were explored, highlight newer areas or replay the map growing, per play session.
- **Share links** with the camera and your layers (no map data is shared).
- Chunk grid (64) and mob grid (16), player marker with spawn radius, custom distance ring.
- Hover/tap inspector (coordinates, distance from the Core, tile name), keyboard shortcuts, command palette (Ctrl K).
- Export to PNG at 1–4× with layers, of the whole map or the current view.
- English and German, light and dark theme, works offline, keyboard and screen-reader accessible (WCAG 2.2 AA).

## Development

Requires Node 22.18+ (24 recommended).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (ingest, analysis, export, data, signals)
npm run e2e          # Playwright + axe (run `npx vite build` first)
npm run lint && npm run typecheck
npx vite build && npm run size   # production build + bundle budgets
```

Append `?canvas2d` to the URL to try the Canvas 2D fallback renderer, `?at=x,y,zoom` to deep-link a spot.

The bundled examples in `public/example/` are a fully revealed 1.0+ world and a fully explored Classic world.
Map files also contain exploration times: a big-endian 32-bit value per tile that grows as tiles are revealed
(see `src/workers/analysis/timeline.ts`).

### Architecture

| Area | Where | Notes |
|---|---|---|
| Ingest | `src/workers/ingest/` | Streaming gzip → byte scanner (no `JSON.parse`) → custom PNG decoder → palette indices, in a worker |
| Model & analysis | `src/workers/model`, `src/workers/analysis` | 16-bit palette cells per 256² chunk, 2×2 block flags, biome sectors via prefix sums, exact maze fit via summed-area tables |
| Rendering | `src/render/` | WebGL2: texture arrays + palette/highlight LUT, overlays in one shader, draws on demand. Canvas 2D fallback |
| Export | `src/workers/export/` | Strip renderer + streaming PNG encoder (no canvas size limits) |
| UI | `src/ui/`, `src/app/` | No framework: small signals core (`src/core/signals.ts`), `h()` DOM helper, design tokens in `src/ui/styles/tokens.css` |
| Game data | `src/data/` | Tiles generated from the wiki, POIs per world type, world layout (zones, sectors, maze sizes) |

### Updating game data

Tile colours come from the Core Keeper Wiki module `Module:ObjectInfo/data` (CC BY-SA):

```bash
npm run data:import      # fetch, regenerate src/data/tiles.generated.json, print a diff
npm run data:validate    # ids, colours, references, zones
```

Boss/dungeon distances live in `src/data/pois.ts`, biome zones in `src/data/world-layout.ts`. Names are in
`src/i18n/locales/{en,de}.json`. Colours the wiki lacks can be added to `LEGACY_TILES` in `src/data/tiles.ts`.

### Deployment

`npx vite build` produces a static site in `dist/`. See `deploy/nginx.conf` for caching, MIME and CSP settings
(the service worker and HTML must not be cached; hashed assets are immutable).

The previous version is kept in `legacy/` for reference only and is not part of the build.

## License

MIT. Tile data from the Core Keeper Wiki (CC BY-SA). Core Keeper is a trademark of Pugstorm; this project is not
affiliated with Pugstorm or Fireshine Games.
