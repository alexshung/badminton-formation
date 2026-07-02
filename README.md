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
scripts/bump-version.js  Deploy helper (cache-bust bump)
```

Scripts communicate through shared globals (intentional for this build-free setup);
`eslint.config.js` is tuned accordingly.

## Deploying

Hosted on GitHub Pages from the repo root. Before pushing a change that touches any
asset, run `npm run bump` so returning visitors don't get a stale cached mix.

## License

MIT
