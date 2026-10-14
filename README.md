# 🏸 Badminton Formation Tool

A fast, build-free web app for **diagramming badminton doubles formations and rallies**.
Place players, draw shots, mark coverage zones, animate a rally across frames, and
export a PNG or video — all in the browser, no account, no backend.

**Live:** https://alexshung.github.io/badminton-formation/

---

## Features

- **Players** — drag to position Team A / Team B; rename; movement arrows per frame.
- **Shots** — Drop / Drive / Smash / Clear / Lift / Serve, each with a distinct trajectory.
- **Frames & timeline** — build a rally frame by frame (up to 8); positions and coverage
  carry forward automatically.
- **Coverage zones** — draw per-player polygons; overlaps are hatched automatically.
- **Annotations** — freehand draw on the court.
- **Animation** — play the rally back with easing; adjustable speed.
- **Presentation mode** — full-screen, distraction-free playback with keyboard control.
- **Export** — PNG (with legend + notes) or WebM video.
- **Share** — state is compressed into a URL you can copy and send.
- **Offline-friendly** — everything persists to `localStorage`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` | Select player A1 / A2 / B1 / B2 |
| `Q` `W` `E` `R` `T` `Y` | Drop / Drive / Smash / Clear / Lift / Serve |
| `←` `→` | Previous / next frame |
| `Space` | Play / stop animation |
| `D` | Duplicate current frame |
| `C` | Clear shot |
| `Ctrl/⌘ + Z` | Undo |
| `?` | Toggle help |

---

## Development

The app is plain HTML/CSS/JS with **no build step** — you can open `index.html` directly.
For a proper local server (so `localStorage`, share links, and exports behave), use:

```bash
npm install      # dev tooling only (linter, formatter, static server)
npm run dev      # serves at http://localhost:5050
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Static dev server on port 5050 |
| `npm run lint` | ESLint over the source |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI-friendly) |
| `npm run bump` | Refresh the `?v=` cache-busting version on all assets before deploy |
| `npm run dema-render -- <scene.json>` | DEMA batch render (needs Playwright) |

## Project structure

```
index.html            Markup + UI chrome, loads the scripts in order
styles.css            All styling (theme vars, layout, responsive/mobile)
vendor/lz-string.js   Vendored LZString (URL state compression) — not linted/formatted
state.js              App state, persistence, undo, presets, frame management, sharing
court.js              SVG generation: court, players, shots, movement, coverage
interactions.js       Pointer/touch/keyboard input, tools, drag logic
animation.js          Rally animation engine + presentation mode
export.js             PNG and WebM export
app.js                Render loop, timeline, init, event wiring
dema.js               DEMA render mode: deterministic per-frame renders + metadata
harness.js            window.BF agent control API (docs/AGENT_API.md)
scripts/agent-driver.mjs  Headless Playwright demo driver
scripts/dema-render.mjs   DEMA batch renderer: scene JSON -> PNGs + metadata
scripts/bump-version.js  Deploy helper (cache-bust bump)
examples/dema/        Example DEMA scene specs
```

Scripts communicate through shared globals (intentional for this build-free setup);
`eslint.config.js` is tuned accordingly.

## DEMA render mode

Deterministic, answer-leak-free frames for DEMA task generation. One PNG per
frame: the top-down court, the players at that instant, a fading shuttle trail
cut at the frame time, a `t = 0.40 s` label and, optionally, a side-view height
strip. By default there are **no shot arrows, movement arrows, landing/endpoint
markers, shot names, title or legend**.

```bash
npm i -D playwright && npx playwright install chromium   # once, dev-only
node scripts/dema-render.mjs examples/dema/*.json --out out/dema --check
```

Output per scene: `frame_00.png …` and `metadata.json` (grader-side only).
`--check` renders everything twice in separate browser launches and exits 2
unless every PNG is byte-identical; `--svg` also writes the SVGs.

### Scene spec

All positions in **metres**: `x` across the court from the left doubles side
line (as drawn), `y` along it from Team A's back line (image bottom) toward
Team B. `h` is height above the floor, `t` is seconds.

```json
{
  "name": "singles-demo",
  "mode": "singles",
  "arrows": false,
  "timestamps": true,
  "heightStrip": { "hMax": 8 },
  "labels": { "A1": "X", "B1": "Y" },
  "shuttle": {
    "trailWindow": 1.0,
    "samples": [
      { "t": 0.0, "x": 1.4, "y": 1.3, "h": 2.6 },
      { "t": 0.1, "x": 1.755, "y": 2.682, "h": 4.384 },
      { "t": 0.2, "x": 1.994, "y": 3.613, "h": 5.502 }
    ]
  },
  "frames": [
    { "t": 0.0, "players": { "A1": [1.45, 1.15], "B1": [3.10, 8.60] } },
    { "t": 0.2, "players": { "A1": [1.70, 1.70], "B1": [3.20, 9.10] } }
  ]
}
```

| Key | Meaning |
| --- | --- |
| `mode` | `"doubles"` (default) or `"singles"`: singles side lines, alleys shaded, only `A1` vs `B1` drawn |
| `frames[].players` | `{ "A1": [x, y], ... }` (or `{x, y}`); ids `A1 A2 B1 B2` |
| `frames[].t` | frame time in seconds, drawn as `t = …` |
| `shuttle.samples` | shuttle polyline over time; frame *i* shows the samples with `t <= frames[i].t` (last `trailWindow` s) as dots fading with age |
| `frames[].trail` | per-frame samples instead of `shuttle` |
| `heightStrip` | `true` or `{ hMax, pxPerMetre }`: panel right of the court, court length vertical (same pixel rows as the court), height across with a metre scale, net drawn side-on |
| `arrows` | `true` draws `frames[].shot` (`{type, from, to}`) arrows; default `false` |
| `timestamps` | `false` hides the time label |
| `pxPerMetre` | top-down scale, default 50 (image is then 609×778 with the strip, 377×778 without) |
| `labels`, `colors`, `playerRadius`, `timeDecimals` | dot labels (≤ 8 chars), per-player colours, dot radius in metres, time decimals |

Malformed specs (unknown players, non-finite numbers, bad mode) throw rather
than render something else.

### Determinism and metadata

- Image size comes only from the options (never the window). `metadata.json`
  gives `courtToPixel` (`px = a·x + c·y + e`, `py = b·x + d·y + f`; at the
  defaults `a = 50, d = -50, e = 36, f = 742`), the height-strip mapping, per-frame
  player/shuttle positions in metres and pixels, and each PNG's sha256.
- Text uses a built-in vector stroke font (`dema.js`); no font files are
  bundled and no system fonts are used, so output does not depend on installed
  fonts.
- No randomness, no clock. PNGs keep only `IHDR/PLTE/tRNS/IDAT/IEND`; text,
  time and other ancillary chunks are stripped.
- Byte-identical across runs on the same Chromium build (recorded in the
  metadata). Other Chromium versions may rasterize anti-aliasing differently.
- Net heights per BWF Statutes Section 4.1 (Laws of Badminton): posts 1.55 m
  (Law 1.4); top of the net 1.524 m at the centre of the court and 1.55 m over
  the doubles side lines (Law 1.10).

The same features are available in the editor state through `window.BF`:
`setShotArrows`, `setFrameTime`, `setShuttlePath`, `setFrameTrail`,
`setGameMode`, `loadScene`, `renderDemaSVG`, `exportDemaPNG`, `demaMetadata`
(see [docs/AGENT_API.md](docs/AGENT_API.md)).

### DEMA policy

Tool code is generator code, so Claude may write it. For any real task, running
the tool into `input_images` and authoring the agent-visible content is done by
**Avocado**. Output for agents must carry no answer leaks: no arrows, no
endpoint markers, no labels naming the shot (keep `arrows` off; never show
`metadata.json` to the agent). The `examples/dema` scenes are tool demos, not
task content.

## Deploying

Hosted on GitHub Pages from the repo root. Before pushing a change that touches any
asset, run `npm run bump` so returning visitors don't get a stale cached mix.

## License

MIT
