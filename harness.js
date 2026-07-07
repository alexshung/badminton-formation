// ===== AGENT CONTROL API (headless harness) =====
//
// A stable, side-effect-safe control surface for driving the tool
// programmatically (e.g. from Playwright/Puppeteer) with NO mouse/touch events.
// Everything here is a thin wrapper over the existing state.js / interactions.js /
// court.js / export.js functions — no diagramming logic is duplicated.
//
// Namespace: window.BF  (alias: window.bfHarness). Chosen to avoid collision
// with the existing free-standing globals (state, tool, render, etc.).
//
// ── COORDINATE SPACE ────────────────────────────────────────────────────────
// All x/y values are "court coordinates": the SVG user-space of the editor's
// <svg viewBox="0 0 SW SH">. With the current constants:
//   SW = 690, SH = 1420   (full canvas including padding)
//   PAD = 40              (margin around the playing area)
//   CW = 610, CH = 1340   (the painted court rectangle)
// So the playing area spans x:[40..650], y:[40..1380]; (0,0) is top-left,
// y increases downward. Team A defends the bottom half, Team B the top.
// These same coordinates are what get serialized into state and scaled into the
// exported PNG/SVG/video. BF.courtInfo() returns these numbers at runtime.

(function () {
  'use strict';

  const PLAYER_IDS = ['A1', 'A2', 'B1', 'B2'];
  const SHOT_TYPES = ['drop', 'drive', 'smash', 'clear', 'lift', 'serve'];

  function requireGlobals() {
    // Guard: the harness must load AFTER the app scripts.
    if (typeof state === 'undefined' || typeof render !== 'function') {
      throw new Error('BF API loaded before app scripts — check <script> order in index.html');
    }
  }

  function clampCoord(v) {
    return Math.max(0, Math.min(SH, Math.round(Number(v))));
  }

  function validPlayerId(id) {
    return PLAYER_IDS.indexOf(id) !== -1;
  }

  // Resolve a player's effective position on the current frame (movement end
  // position if one exists, else base position) — mirrors interactions.js.
  function playerOrigin(f, id) {
    if (!f.players[id]) return null;
    const mv = f.movements[id];
    return mv ? { x: mv.x, y: mv.y } : { x: f.players[id].x, y: f.players[id].y };
  }

  const BF = {
    /** Constants describing the coordinate space (see file header). */
    courtInfo: function () {
      return {
        viewBox: { width: SW, height: SH },
        padding: PAD,
        court: { width: CW, height: CH, x: PAD, y: PAD },
        playingArea: { minX: PAD, minY: PAD, maxX: PAD + CW, maxY: PAD + CH },
        playerIds: PLAYER_IDS.slice(),
        shotTypes: SHOT_TYPES.slice(),
      };
    },

    /** Full clean reset (all frames + players). Unlike resetAll() there is no
     *  confirm() dialog, so it is safe to call headlessly. */
    reset: function () {
      requireGlobals();
      pushUndo();
      state = {
        mode: state.mode,
        currentFrame: 0,
        frames: [createEmptyFrame(), createEmptyFrame(), createEmptyFrame()],
        title: state.title || 'Doubles Formation',
        playerNames: {},
        exportBg: state.exportBg || 'dark',
        courtOrientation: state.courtOrientation || 'auto',
      };
      undoStack = [];
      const titleEl = document.getElementById('titleInput');
      if (titleEl) titleEl.value = state.title;
      render();
      updateUndoBtn();
      return this;
    },

    /** Alias for reset(). */
    clearAll: function () {
      return this.reset();
    },

    /** Select which frame subsequent add/move calls target (0-based). */
    setFrame: function (index) {
      requireGlobals();
      const i = Math.max(0, Math.min(state.frames.length - 1, index | 0));
      // switchFrame carries positions forward like the UI does.
      switchFrame(i);
      return this;
    },

    /** Append a new frame (inherits previous positions), returns its index. */
    addFrame: function () {
      requireGlobals();
      addFrame();
      return state.currentFrame;
    },

    /** Place/replace a player on the current frame.
     *  opts: { team: 'A'|'B', x, y, id?, label? }
     *  - id (A1/A2/B1/B2) is optional; if omitted the next free slot for `team`
     *    is used. Returns the resolved id. */
    addPlayer: function (opts) {
      requireGlobals();
      opts = opts || {};
      const f = currentFrameData();
      let id = opts.id;
      if (!id) {
        const team = (opts.team || 'A').toUpperCase();
        id = PLAYER_IDS.filter((p) => p[0] === team).find((p) => !f.players[p]);
        if (!id) throw new Error('No free slot for team ' + team + ' (A/B each hold 2 players)');
      }
      if (!validPlayerId(id)) throw new Error('Invalid player id: ' + id + ' (expected A1/A2/B1/B2)');
      if (opts.x == null || opts.y == null) throw new Error('addPlayer requires x and y');
      pushUndo();
      f.players[id] = { x: clampCoord(opts.x), y: clampCoord(opts.y) };
      if (opts.label != null && String(opts.label) !== id) {
        state.playerNames[id] = String(opts.label).substring(0, 8);
      }
      render();
      saveState();
      return id;
    },

    /** Move a player. On frame 0 this repositions the base placement; on later
     *  frames it sets the movement (arrow) end position — matching the UI. */
    movePlayer: function (id, x, y) {
      requireGlobals();
      if (!validPlayerId(id)) throw new Error('Invalid player id: ' + id);
      const f = currentFrameData();
      if (!f.players[id]) throw new Error('Player ' + id + ' is not on frame ' + state.currentFrame);
      pushUndo();
      if (state.currentFrame === 0) {
        f.players[id] = { x: clampCoord(x), y: clampCoord(y) };
      } else {
        f.movements[id] = { x: clampCoord(x), y: clampCoord(y) };
      }
      render();
      saveState();
      return this;
    },

    /** Add/replace the shot on the current frame.
     *  opts: { type, toXY:{x,y}, fromId? , fromXY?:{x,y} }
     *  Origin resolution (like the court UI): explicit fromXY > fromId's
     *  position > selected player > nearest player to toXY. */
    addShot: function (opts) {
      requireGlobals();
      opts = opts || {};
      const type = opts.type || shotType;
      if (SHOT_TYPES.indexOf(type) === -1) throw new Error('Invalid shot type: ' + type);
      if (!opts.toXY || opts.toXY.x == null || opts.toXY.y == null) {
        throw new Error('addShot requires toXY:{x,y}');
      }
      const f = currentFrameData();
      let origin = null;
      if (opts.fromXY && opts.fromXY.x != null && opts.fromXY.y != null) {
        origin = { x: clampCoord(opts.fromXY.x), y: clampCoord(opts.fromXY.y) };
      } else if (opts.fromId) {
        if (!validPlayerId(opts.fromId)) throw new Error('Invalid fromId: ' + opts.fromId);
        origin = playerOrigin(f, opts.fromId);
        if (!origin) throw new Error('fromId ' + opts.fromId + ' is not on this frame');
      } else if (selectedPlayer && f.players[selectedPlayer]) {
        origin = playerOrigin(f, selectedPlayer);
      } else {
        // Nearest player to the landing spot (findPlayerAt with unbounded radius).
        const near = findPlayerAt(clampCoord(opts.toXY.x), clampCoord(opts.toXY.y), f, Infinity);
        if (near) origin = playerOrigin(f, near);
      }
      if (!origin) throw new Error('No origin available — place a player first');
      pushUndo();
      f.shot = {
        type: type,
        x1: origin.x,
        y1: origin.y,
        x2: clampCoord(opts.toXY.x),
        y2: clampCoord(opts.toXY.y),
      };
      render();
      saveState();
      return this;
    },

    /** Remove the shot on the current frame. */
    clearShot: function () {
      requireGlobals();
      clearShot();
      return this;
    },

    /** Apply one of the built-in preset formations to the current frame. */
    applyPreset: function (key) {
      requireGlobals();
      if (!PRESETS[key]) throw new Error('Unknown preset: ' + key);
      applyPreset(key);
      return this;
    },

    /** Start the rally animation (wraps startAnimation). */
    play: function () {
      requireGlobals();
      if (typeof animRunning !== 'undefined' && animRunning) return this;
      startAnimation();
      return this;
    },

    /** Stop the rally animation (wraps stopAnimation). */
    stop: function () {
      requireGlobals();
      if (typeof animRunning !== 'undefined' && animRunning) stopAnimation();
      return this;
    },

    /** True while the animation loop is running. */
    isPlaying: function () {
      return typeof animRunning !== 'undefined' && !!animRunning;
    },

    /** Deep-cloned, serializable snapshot of the full formation state. */
    getState: function () {
      requireGlobals();
      return JSON.parse(JSON.stringify(state));
    },

    /** Replace the entire formation with `obj` (same shape as getState()).
     *  Reuses state.js normalization so partial/old snapshots still load. */
    loadState: function (obj) {
      requireGlobals();
      if (!obj || !Array.isArray(obj.frames) || obj.frames.length === 0) {
        throw new Error('loadState requires an object with a non-empty frames array');
      }
      pushUndo();
      state = JSON.parse(JSON.stringify(obj));
      if (!state.playerNames) state.playerNames = {};
      if (!state.exportBg) state.exportBg = 'dark';
      if (!state.courtOrientation) state.courtOrientation = 'auto';
      if (!state.mode) state.mode = 'overlay';
      if (typeof state.currentFrame !== 'number') state.currentFrame = 0;
      state.currentFrame = Math.max(0, Math.min(state.frames.length - 1, state.currentFrame));
      state.frames.forEach((f) => {
        if (!f.players) f.players = {};
        if (!f.movements) f.movements = {};
        if (f.shot === undefined) f.shot = null;
        if (!f.regions) f.regions = {};
        if (!f.note) f.note = '';
        if (f.label === undefined) f.label = '';
        if (!f.annotations) f.annotations = [];
      });
      const titleEl = document.getElementById('titleInput');
      if (titleEl) titleEl.value = state.title || 'Doubles Formation';
      render();
      saveState();
      return this;
    },

    /** Set the diagram title (baked into exports). */
    setTitle: function (title) {
      requireGlobals();
      state.title = String(title || '');
      const el = document.getElementById('titleInput');
      if (el) el.value = state.title;
      saveState();
      return this;
    },

    /** Overlay (frames stacked) or panel (frames side-by-side) export layout. */
    setMode: function (mode) {
      requireGlobals();
      setMode(mode === 'panel' ? 'panel' : 'overlay');
      return this;
    },

    /** Build the export SVG string for the current state.
     *  opts: { width?, height? }  (defaults 1200x630)
     *  Returns { svg, dataUrl } where dataUrl is an image/svg+xml data URL. */
    exportSVG: function (opts) {
      requireGlobals();
      opts = opts || {};
      const w = opts.width || parseInt((document.getElementById('expW') || {}).value, 10) || 1200;
      const h = opts.height || parseInt((document.getElementById('expH') || {}).value, 10) || 630;
      const svg = buildExportSVG(w, h);
      return {
        svg: svg,
        dataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      };
    },

    /** Rasterize the current state to PNG. Returns a Promise resolving to
     *  { dataUrl, width, height, blob }. `blob` may be null if the browser
     *  can't produce one synchronously. */
    exportPNG: function (opts) {
      requireGlobals();
      opts = opts || {};
      const w = opts.width || parseInt((document.getElementById('expW') || {}).value, 10) || 1200;
      const h = opts.height || parseInt((document.getElementById('expH') || {}).value, 10) || 630;
      const isDark = (document.getElementById('exportBg') || {}).value !== 'light';
      const bgColor = isDark ? '#111318' : '#FAFAFA';
      const svg = buildExportSVG(w, h);
      return renderSVGToCanvas(svg, w, h, bgColor).then(function (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        return new Promise(function (resolve) {
          if (canvas.toBlob) {
            canvas.toBlob(function (blob) {
              resolve({ dataUrl: dataUrl, width: w, height: h, blob: blob });
            }, 'image/png');
          } else {
            resolve({ dataUrl: dataUrl, width: w, height: h, blob: null });
          }
        });
      });
    },

    /** Record the rally animation to a WebM Blob (MediaRecorder).
     *  opts: { width?, height?, speed? }. Returns Promise<{ blob, dataUrl,
     *  mimeType }>. Rejects if MediaRecorder / WebM is unavailable. */
    exportVideo: function (opts) {
      requireGlobals();
      opts = opts || {};
      const w = opts.width || parseInt((document.getElementById('expW') || {}).value, 10) || 1200;
      const h = opts.height || parseInt((document.getElementById('expH') || {}).value, 10) || 630;
      const isDark = (document.getElementById('exportBg') || {}).value !== 'light';
      const bgColor = isDark ? '#111318' : '#FAFAFA';
      const speed = opts.speed || parseFloat((document.getElementById('animSpeed') || {}).value) || 1;
      const title = state.title || 'Badminton Formation';
      return captureVideoBlob({ w: w, h: h, title: title, bgColor: bgColor, speed: speed }).then(
        function (blob) {
          return new Promise(function (resolve) {
            const reader = new FileReader();
            reader.onloadend = function () {
              resolve({ blob: blob, dataUrl: reader.result, mimeType: 'video/webm' });
            };
            reader.readAsDataURL(blob);
          });
        }
      );
    },

    /** Version tag so a driver can assert the API it expects is present. */
    version: '1.0.0',
  };

  window.BF = BF;
  window.bfHarness = BF; // alias
})();
