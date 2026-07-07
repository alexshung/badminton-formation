# Agent Control API

A stable, headless-friendly control surface for driving the Badminton Formation
Tool programmatically — no mouse or touch events required. An AI agent (or any
script) can build a formation, run the animation, and capture the output as
images and video.

The API is a thin wrapper over the app's existing functions
(`state.js` / `interactions.js` / `court.js` / `animation.js` / `export.js`).
No diagramming logic is duplicated.

- **Namespace:** `window.BF` (alias: `window.bfHarness`)
- **Defined in:** [`harness.js`](../harness.js), loaded last in `index.html`
- **Runtime deps added to the app:** none. `harness.js` is plain vanilla JS.
- **Headless driver:** [`scripts/agent-driver.mjs`](../scripts/agent-driver.mjs)
  (dev-only, Playwright).

---

## Coordinate space

All `x` / `y` values are **court coordinates** — the SVG user-space of the
editor's `<svg viewBox="0 0 SW SH">`. With the current constants (`state.js`):

| Constant | Value | Meaning |
| --- | --- | --- |
| `SW` × `SH` | `690` × `1420` | Full canvas incl. padding (the viewBox) |
| `PAD` | `40` | Margin around the playing area |
| `CW` × `CH` | `610` × `1340` | The painted court rectangle |

- Origin `(0, 0)` is **top-left**; `y` increases **downward**.
- The playing area spans `x: [40 … 650]`, `y: [40 … 1380]`.
- **Team A** defends the **bottom** half; **Team B** the **top** half.
- These are the same numbers serialized into state and scaled into the exported
  PNG / SVG / video (export math lives in `export.js` and fits the court to the
  requested pixel size automatically).

Call `BF.courtInfo()` at runtime to get all of these values, plus the valid
player IDs and shot types. Out-of-range coordinates are clamped to `[0, SH]`.

---

## API reference

Every mutating method returns the `BF` object (chainable) unless noted. Methods
operate on the **current frame** unless they change it.

### Lifecycle / state

| Method | Params | Returns | Notes |
| --- | --- | --- | --- |
| `courtInfo()` | — | object | Coordinate space, `playerIds`, `shotTypes` |
| `reset()` | — | `BF` | Clean 3-frame reset. **No `confirm()`** (safe headless) |
| `clearAll()` | — | `BF` | Alias for `reset()` |
| `getState()` | — | object | Deep-cloned serializable snapshot |
| `loadState(obj)` | full state object | `BF` | Replaces everything; normalizes old/partial snapshots |
| `setTitle(str)` | title | `BF` | Baked into exports |
| `setMode(mode)` | `'overlay'` \| `'panel'` | `BF` | Export layout: stacked vs side-by-side |
| `version` | — | string | API version (property, not a method) |

### Frames

| Method | Params | Returns | Notes |
| --- | --- | --- | --- |
| `setFrame(i)` | index (0-based) | `BF` | Switches frame; carries positions forward like the UI |
| `addFrame()` | — | number | Appends a frame (inherits positions), returns its index |

### Players

| Method | Params | Returns | Notes |
| --- | --- | --- | --- |
| `addPlayer(opts)` | `{ team, x, y, id?, label? }` | `id` string | Places/replaces a player. `id` (`A1`/`A2`/`B1`/`B2`) optional; if omitted, next free slot for `team` (`'A'`/`'B'`) is used. `label` renames (≤ 8 chars) |
| `movePlayer(id, x, y)` | id, coords | `BF` | On **frame 0** repositions the base placement; on **later frames** sets the movement-arrow end position (matches UI) |

### Shots

| Method | Params | Returns | Notes |
| --- | --- | --- | --- |
| `addShot(opts)` | `{ type, toXY, fromId?, fromXY? }` | `BF` | Sets the current frame's shot. `type` ∈ `drop/drive/smash/clear/lift/serve`. Origin resolution: `fromXY` > `fromId`'s position > selected player > **nearest** player to `toXY` |
| `clearShot()` | — | `BF` | Removes the current frame's shot |
| `applyPreset(key)` | preset key | `BF` | e.g. `front-back-attack`, `side-by-side-defense` (see `PRESETS` in `state.js`) |

A shot is stored as `{ type, x1, y1, x2, y2 }` (origin → landing).

### Animation

| Method | Params | Returns | Notes |
| --- | --- | --- | --- |
| `play()` | — | `BF` | Starts the rally animation (`startAnimation`) |
| `stop()` | — | `BF` | Stops it (`stopAnimation`) |
| `isPlaying()` | — | boolean | — |

Note: exporting a **video** runs its own deterministic frame loop
(`captureVideoBlob`) and does not depend on `play()`.

### Export / capture

| Method | Params | Returns |
| --- | --- | --- |
| `exportSVG(opts?)` | `{ width?, height? }` (default 1200×630) | `{ svg, dataUrl }` — SVG string + `image/svg+xml` data URL (synchronous) |
| `exportPNG(opts?)` | `{ width?, height? }` | `Promise<{ dataUrl, width, height, blob }>` — PNG data URL; `blob` may be `null` if the browser can't produce one |
| `exportVideo(opts?)` | `{ width?, height?, speed? }` | `Promise<{ blob, dataUrl, mimeType }>` — WebM. **Rejects** if `MediaRecorder`/WebM is unavailable |

---

## Capturing images and video

- **SVG** — fully synchronous and dependency-free. `BF.exportSVG().svg` is a
  complete standalone SVG document you can write straight to a `.svg` file.
- **PNG** — `BF.exportPNG()` rasterizes that SVG onto the app's offscreen
  `<canvas>` via an `Image`, then returns `canvas.toDataURL('image/png')`.
  Decode `dataUrl` (strip the `data:...,` prefix, base64-decode) to get bytes.
- **Video** — `BF.exportVideo()` uses `canvas.captureStream()` +
  `MediaRecorder` to record the animated rally to a **WebM** blob. This depends
  on browser support:
  - Works in Chromium (headed and, in current builds, headless).
  - If `MediaRecorder` or WebM encoding is unavailable, the promise **rejects**
    — drivers should `catch` and continue (the example driver does).
  - For an MP4 or a guaranteed-deterministic capture independent of
    `MediaRecorder`, capture frames instead: call `BF.exportSVG()` /
    `BF.exportPNG()` while stepping frames with `BF.setFrame(i)`, save each PNG,
    and assemble them with `ffmpeg` outside the browser. The per-frame animation
    interpolation lives in `captureVideoBlob` (`export.js`) if you need to
    reproduce the tween math frame-exactly.

---

## Headless driver

[`scripts/agent-driver.mjs`](../scripts/agent-driver.mjs) is a **dev-only**
Playwright script. It is not referenced by `index.html` and adds no runtime
dependency. It:

1. starts a tiny built-in static server for the repo root (no external hosting,
   no CDN — everything local/vendored),
2. launches headless Chromium and opens `index.html`,
3. suppresses the first-run onboarding overlay via `localStorage`,
4. waits for `window.BF`, builds an example 2-frame rally,
5. writes `scripts/out/formation.png` and (if supported) `scripts/out/rally.webm`.

### One-time setup

Playwright is **not** in `devDependencies` (to keep installs light and offline).
Install it once:

```bash
npm i -D playwright
npx playwright install chromium
```

### Run

```bash
node scripts/agent-driver.mjs
# or:
npm run agent-driver
```

Output lands in `scripts/out/` (git-ignored).

---

## Copy-pasteable example (in-page)

Paste into the browser console on the live app, or run via
`page.evaluate(...)` from Playwright:

```js
const BF = window.BF;
const { minX, minY, maxX, maxY } = BF.courtInfo().playingArea;
const midX = (minX + maxX) / 2;

BF.reset();
BF.setTitle('Attack sequence');

// Frame 1
BF.addPlayer({ id: 'A1', x: midX, y: minY + (maxY - minY) * 0.82 });
BF.addPlayer({ id: 'A2', x: midX, y: minY + (maxY - minY) * 0.6 });
BF.addPlayer({ id: 'B1', x: minX + (maxX - minX) * 0.35, y: minY + (maxY - minY) * 0.28 });
BF.addPlayer({ id: 'B2', x: minX + (maxX - minX) * 0.65, y: minY + (maxY - minY) * 0.28 });
BF.addShot({ type: 'smash', fromId: 'A1', toXY: { x: midX, y: minY + (maxY - minY) * 0.2 } });

// Frame 2: A2 moves to net, B1 lifts
BF.addFrame();
BF.setFrame(1);
BF.movePlayer('A2', midX, minY + (maxY - minY) * 0.5);
BF.addShot({ type: 'lift', fromId: 'B1', toXY: { x: midX, y: minY + (maxY - minY) * 0.9 } });

// Inspect + capture
const snapshot = BF.getState();
const svg = BF.exportSVG({ width: 1200, height: 630 }).svg;
const { dataUrl } = await BF.exportPNG({ width: 1200, height: 630 });
// (optional) const { blob } = await BF.exportVideo({ width: 960, height: 540 });
```

---

## Limitations

- **Video** depends on the browser's `MediaRecorder` + WebM support; there is no
  MP4 encoder in-browser. Assemble MP4 externally from per-frame PNGs if needed.
- **Fixed roster:** exactly four player slots (`A1`, `A2`, `B1`, `B2`), matching
  doubles. `addPlayer` throws if a team's two slots are full.
- **`reset()` clears the undo stack** (like the app's Reset All) so it starts
  from a clean, deterministic base.
- Persistence side effects still run: the API calls `saveState()`, so the
  formation is written to `localStorage`/`sessionStorage`/`window.name` just as
  interactive edits are. Use a fresh browser context per run for isolation.
- The API assumes it loads **after** the app scripts; each method guards with a
  clear error if that invariant is violated.
