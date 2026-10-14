// ===== DEMA RENDER MODE =====
//
// Deterministic, answer-leak-free per-frame renders for task generation.
// One image per frame: the top-down court (plus an optional side-view height
// strip), the players at that instant, the shuttle trail cut at the frame time
// and a small "t = …" label. By default there are NO shot arrows, movement
// arrows, coverage zones, title, legend, notes or shot names, and the trail
// never shows a sample after the frame time (so no landing/endpoint marker).
//
// All text is drawn with the built-in vector stroke font below (no font files,
// no system fonts), so the output does not depend on what is installed.
// Nothing here uses randomness or the clock.

const DEMA_VERSION = '1.0.0';

// BWF Statutes Section 4.1, Laws of Badminton — Law 1.4: posts 1.55 m high;
// Law 1.10: top of the net 1.524 m at the centre of the court and 1.55 m over
// the doubles side lines.
const BWF_NET_HEIGHT = { centre: 1.524, sidelines: 1.55, posts: 1.55 };

const DEMA_PLAYER_ORDER = ['A1', 'A2', 'B1', 'B2'];
// Four distinct colours so every dot is identifiable without its label.
const DEMA_PLAYER_COLORS = { A1: '#00d4ff', A2: '#3b6cff', B1: '#ff6b9d', B2: '#ffa62b' };

const DEMA_DEFAULTS = {
  pxPerMetre: 50, // top-down scale: image pixels per court metre
  margin: 16,
  headerH: 36,
  bg: '#111318',
  arrows: false, // shot arrows give the answer away: off unless asked for
  timestamps: true,
  heightStrip: false, // true or { hMax, pxPerMetre }
  stripHMax: 8, // metres shown on the height axis
  stripPxPerMetre: 25, // height-axis scale
  stripGap: 20,
  stripPad: 6,
  playerRadius: 0.3, // metres
  colors: null, // per-player colour overrides { A1: '#…' }
  timeDecimals: 2,
};

// ===== VECTOR STROKE FONT =====
// Glyphs on a 4 × 6 grid (cap height 6, y down), as polylines. Lowercase
// letters without their own glyph fall back to uppercase.
// prettier-ignore
const VEC_GLYPHS = {
  0: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  1: [[[1, 1], [2, 0], [2, 6]], [[1, 6], [3, 6]]],
  2: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]],
  3: [[[0, 0], [4, 0], [2, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [1, 6], [0, 5]]],
  4: [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  5: [[[4, 0], [0, 0], [0, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [0, 6]]],
  6: [[[3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.5], [3, 2.5], [0, 2.5]]],
  7: [[[0, 0], [4, 0], [1.5, 6]]],
  8: [
    [[1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3]],
    [[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]],
  ],
  9: [[[4, 3.5], [1, 3.5], [0, 2.5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6]]],
  A: [[[0, 6], [2, 0], [4, 6]], [[0.7, 4], [3.3, 4]]],
  B: [
    [[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]],
    [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3]],
  ],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.5], [2.5, 3.5]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.5]], [[1.3, 2.7], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.5, 4.5], [4, 6]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  h: [[[0, 0], [0, 6]], [[0, 3], [1, 2], [3, 2], [4, 3], [4, 6]]],
  m: [[[0, 6], [0, 2]], [[0, 2.8], [0.8, 2], [1.4, 2], [2, 2.6], [2, 6]], [[2, 2.6], [2.6, 2], [3.2, 2], [4, 2.8], [4, 6]]],
  s: [[[3.6, 2.4], [3, 2], [1, 2], [0.4, 2.6], [0.4, 3.4], [1, 4], [3, 4], [3.6, 4.6], [3.6, 5.4], [3, 6], [1, 6], [0.4, 5.6]]],
  t: [[[1.5, 0.5], [1.5, 5.2], [2.3, 6], [3.5, 6]], [[0.3, 2], [3.3, 2]]],
  '.': [[[1, 5.8], [1, 6]]],
  ':': [[[1, 2], [1, 2.2]], [[1, 5.8], [1, 6]]],
  '=': [[[0.5, 2.5], [3.5, 2.5]], [[0.5, 4], [3.5, 4]]],
  '-': [[[0.8, 3.3], [3.2, 3.3]]],
  '/': [[[0, 6], [4, 0]]],
  '(': [[[2.5, 0], [1.5, 1.5], [1.5, 4.5], [2.5, 6]]],
  ')': [[[1.5, 0], [2.5, 1.5], [2.5, 4.5], [1.5, 6]]],
};
const VEC_ADVANCE = 5.6;
const VEC_ADVANCE_NARROW = { '.': 2.6, ':': 2.6, ' ': 3.4, '(': 4, ')': 4 };

function vecGlyph(ch) {
  return VEC_GLYPHS[ch] || VEC_GLYPHS[ch.toUpperCase()] || null;
}
function vecAdvance(ch) {
  return VEC_ADVANCE_NARROW[ch] || VEC_ADVANCE;
}
function vecTextWidth(str, size) {
  const chars = String(str).split('');
  if (chars.length === 0) return 0;
  const units = chars.reduce((sum, ch) => sum + vecAdvance(ch), 0) - (VEC_ADVANCE - 4);
  return (units * size) / 6;
}

// Draw `str` as one stroked <path>. size = cap height in user units.
// opts: { anchor: 'start'|'middle'|'end', baseline: 'top'|'middle'|'bottom', strokeWidth }
function vecTextSVG(str, x, y, size, color, opts) {
  opts = opts || {};
  const text = String(str);
  const k = size / 6;
  const w = vecTextWidth(text, size);
  let x0 = x;
  if (opts.anchor === 'middle') x0 = x - w / 2;
  else if (opts.anchor === 'end') x0 = x - w;
  let y0 = y;
  if (opts.baseline === 'middle') y0 = y - size / 2;
  else if (opts.baseline === 'bottom') y0 = y - size;
  let d = '';
  let cx = 0;
  for (const ch of text) {
    const g = vecGlyph(ch);
    if (g) {
      for (const stroke of g) {
        d += stroke
          .map(
            (p, i) =>
              (i === 0 ? 'M' : 'L') + svgNum(x0 + (cx + p[0]) * k) + ',' + svgNum(y0 + p[1] * k)
          )
          .join('');
      }
    }
    cx += vecAdvance(ch);
  }
  if (!d) return '';
  const sw = svgNum(opts.strokeWidth || Math.max(1, size * 0.14));
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ===== OPTIONS + LAYOUT =====

// Merge defaults < state.dema (set by a loaded scene) < call options.
function demaOptions(opts) {
  const o = Object.assign({}, DEMA_DEFAULTS, state.dema || {}, opts || {});
  if (o.heightStrip === true) o.heightStrip = {};
  if (o.heightStrip && typeof o.heightStrip !== 'object') o.heightStrip = false;
  return o;
}

// Fixed pixel layout, derived only from the options (never from the window).
// The court is drawn in court units (100 per metre) scaled by s = pxPerMetre/100.
function demaLayout(o) {
  const P = o.pxPerMetre;
  if (!(P > 0)) throw new Error('pxPerMetre must be > 0');
  const s = P / UNITS_PER_M;
  const M = o.margin;
  const courtX = M;
  const courtY = M + o.headerH;
  let width = courtX + SW * s + M;
  let strip = null;
  if (o.heightStrip) {
    const hMax = o.heightStrip.hMax || o.stripHMax;
    const ph = o.heightStrip.pxPerMetre || o.stripPxPerMetre;
    const x = courtX + SW * s + o.stripGap;
    strip = { x: x, hx0: x + o.stripPad, ph: ph, hMax: hMax, w: o.stripPad * 2 + hMax * ph };
    width = x + strip.w + M;
  }
  const height = courtY + SH * s + M;
  // Court metres -> image pixels (SVG matrix a b c d e f):
  //   px = a*x + c*y + e ;  py = b*x + d*y + f
  const matrix = { a: P, b: 0, c: 0, d: -P, e: courtX + s * PAD, f: courtY + s * (PAD + CH) };
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    s: s,
    courtX: courtX,
    courtY: courtY,
    top: courtY + s * PAD,
    bottom: courtY + s * (PAD + CH),
    matrix: matrix,
    strip: strip,
  };
}

function demaTimeLabel(t, o) {
  return 't = ' + t.toFixed(o.timeDecimals) + ' s';
}

// ===== FRAME RENDERING =====

function demaPlayerSVG(pid, x, y, o) {
  const color = (o.colors && o.colors[pid]) || DEMA_PLAYER_COLORS[pid];
  const r = o.playerRadius * UNITS_PER_M;
  const label = getPlayerLabel(pid);
  const filled = pid[0] === 'A'; // Team A filled, Team B outlined (as in the editor)
  let svg = filled
    ? `<circle cx="${svgNum(x)}" cy="${svgNum(y)}" r="${svgNum(r)}" fill="${color}" stroke="#0b0e14" stroke-width="3"/>`
    : `<circle cx="${svgNum(x)}" cy="${svgNum(y)}" r="${svgNum(r)}" fill="#0b0e14" stroke="${color}" stroke-width="6"/>`;
  // Shrink long labels to fit inside the dot.
  const size = Math.min(r * 0.75, (1.5 * r * 6) / Math.max(1, vecTextWidth(label, 6)));
  svg += vecTextSVG(label, x, y, size, filled ? '#0b0e14' : color, {
    anchor: 'middle',
    baseline: 'middle',
    strokeWidth: Math.max(2, size * 0.16),
  });
  return svg;
}

function demaHeightStripSVG(points, L) {
  const st = L.strip;
  const hx = (h) => svgNum(st.hx0 + h * st.ph);
  const py = (yCourt) => svgNum(L.courtY + L.s * yCourt);
  const top = svgNum(L.top);
  const bot = svgNum(L.bottom);
  const muted = '#8b919a';
  let svg = `<rect x="${st.x}" y="${top}" width="${st.w}" height="${svgNum(bot - top)}" fill="#0f1624" stroke="#2d3139" stroke-width="1"/>`;
  // Height scale: a gridline + label every metre.
  for (let h = 0; h <= st.hMax; h++) {
    const x = hx(h);
    svg += `<line x1="${x}" y1="${top}" x2="${x}" y2="${bot}" stroke="${h === 0 ? muted : '#262b35'}" stroke-width="${h === 0 ? 1.5 : 1}"/>`;
    svg += vecTextSVG(String(h), x, top - 5, 7, muted, { anchor: 'middle', baseline: 'bottom' });
  }
  svg += vecTextSVG('HEIGHT (m)', st.x + st.w / 2, top - 18, 7, muted, {
    anchor: 'middle',
    baseline: 'bottom',
  });
  // Net seen side-on at mid-court: post to 1.55 m (Law 1.4), tape at 1.524 m
  // at the centre of the court (Law 1.10).
  const netY = py(PAD + CH / 2);
  svg += `<line x1="${hx(0)}" y1="${netY}" x2="${hx(BWF_NET_HEIGHT.posts)}" y2="${netY}" stroke="#00d4ff" stroke-width="1" stroke-dasharray="2,2"/>`;
  svg += `<line x1="${hx(0)}" y1="${netY}" x2="${hx(BWF_NET_HEIGHT.centre)}" y2="${netY}" stroke="#00d4ff" stroke-width="3"/>`;
  svg += `<line x1="${hx(BWF_NET_HEIGHT.centre)}" y1="${svgNum(netY - 5)}" x2="${hx(BWF_NET_HEIGHT.centre)}" y2="${svgNum(netY + 5)}" stroke="#00d4ff" stroke-width="1.5"/>`;
  svg += vecTextSVG('NET 1.524', hx(BWF_NET_HEIGHT.posts) + 5, netY - 3, 6, '#00d4ff', {
    baseline: 'bottom',
  });
  svg += vecTextSVG('POST 1.55', hx(BWF_NET_HEIGHT.posts) + 5, netY + 3, 6, muted, {
    baseline: 'top',
  });
  // Shuttle samples: height across, court length down (same y as the court).
  svg += trailSVG(points, 1, {
    project: (p) => ({ x: st.hx0 + (p.h || 0) * st.ph, y: L.courtY + L.s * p.y }),
    radius: 3,
    headRadius: 4.5,
  });
  return svg;
}

// Build the DEMA SVG for frame i of the current state.
// Returns { svg, width, height, layout }.
function buildDemaFrameSVG(i, opts) {
  const f = state.frames[i];
  if (!f) throw new Error('No frame ' + i);
  const o = demaOptions(opts);
  const L = demaLayout(o);
  resetSvgUid(); // marker ids restart per image -> identical SVG for identical input
  const W = L.width;
  const H = L.height;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += courtGradientDefs();
  svg += `<rect width="${W}" height="${H}" fill="${o.bg}"/>`;
  if (o.timestamps && hasFrameTime(f)) {
    svg += vecTextSVG(demaTimeLabel(f.t, o), o.margin, o.margin + o.headerH / 2, 14, '#e8eaed', {
      baseline: 'middle',
      strokeWidth: 2,
    });
  }
  const trail = frameTrail(i);
  svg += `<g transform="translate(${L.courtX},${L.courtY}) scale(${L.s})">`;
  svg += courtLines({ netLabel: false });
  if (o.arrows && f.shot) svg += shotSVG(f.shot, 1);
  for (const pid of DEMA_PLAYER_ORDER) {
    const p = f.players[pid];
    if (!p || !isPlayerShown(pid)) continue;
    svg += demaPlayerSVG(pid, p.x, p.y, o);
  }
  svg += trailSVG(trail, 1, { radius: 8, headRadius: 12 });
  svg += '</g>';
  if (L.strip) svg += demaHeightStripSVG(trail, L);
  svg += '</svg>';
  return { svg: svg, width: W, height: H, layout: L };
}

// ===== METADATA =====

function demaPoint(L, x, y) {
  const m = courtToMetres(x, y);
  return {
    x_m: Math.round(m.x * 1e4) / 1e4,
    y_m: Math.round(m.y * 1e4) / 1e4,
    px: svgNum(L.matrix.a * m.x + L.matrix.c * m.y + L.matrix.e),
    py: svgNum(L.matrix.b * m.x + L.matrix.d * m.y + L.matrix.f),
  };
}

// Grader-side metadata for the current state (never show it to the agent).
// Deterministic: no clock, no randomness.
function demaMetadata(opts) {
  const o = demaOptions(opts);
  const L = demaLayout(o);
  const frames = state.frames.map((f, i) => {
    const players = {};
    for (const pid of DEMA_PLAYER_ORDER) {
      const p = f.players[pid];
      if (p && isPlayerShown(pid)) players[pid] = demaPoint(L, p.x, p.y);
    }
    const trail = frameTrail(i);
    const head = trail.length ? trail[trail.length - 1] : null;
    return {
      index: i,
      t: hasFrameTime(f) ? f.t : null,
      players: players,
      trailSamples: trail.length,
      shuttle: head ? Object.assign(demaPoint(L, head.x, head.y), { h_m: head.h || 0 }) : null,
    };
  });
  const m = L.matrix;
  return {
    renderer: 'badminton-formation DEMA render mode',
    rendererVersion: DEMA_VERSION,
    image: { width: L.width, height: L.height, background: o.bg },
    gameMode: isSinglesMode() ? 'singles' : 'doubles',
    options: {
      arrows: !!o.arrows,
      timestamps: !!o.timestamps,
      heightStrip: !!L.strip,
      pxPerMetre: o.pxPerMetre,
      playerRadius_m: o.playerRadius,
      trailWindow_s: typeof state.trailWindow === 'number' ? state.trailWindow : null,
    },
    courtMetres: {
      origin: "left doubles side line (as drawn) x Team A's back boundary line (image bottom)",
      x: 'across the court, image left -> right, 0..6.10',
      y: "along the court, Team A's back line (bottom) -> Team B's back line (top), 0..13.40",
      length: COURT_M.length,
      width: COURT_M.width,
      singlesSideLines_x: [COURT_M.singlesInset, COURT_M.width - COURT_M.singlesInset],
      net_y: COURT_M.length / 2,
    },
    courtToPixel: {
      convention:
        'continuous image coordinates, (0,0) = top-left corner of the top-left pixel; px = a*x_m + c*y_m + e, py = b*x_m + d*y_m + f',
      a: m.a,
      b: m.b,
      c: m.c,
      d: m.d,
      e: m.e,
      f: m.f,
      matrix3x3: [
        [m.a, m.c, m.e],
        [m.b, m.d, m.f],
        [0, 0, 1],
      ],
    },
    heightStrip: L.strip
      ? {
          placement: 'right of the court, court length on the vertical axis (same py as the court)',
          heightToPixelX: {
            scale: L.strip.ph,
            offset: L.strip.hx0,
            formula: 'px = offset + scale*h_m',
          },
          lengthToPixelY: { d: m.d, f: m.f, formula: 'py = d*y_m + f' },
          hMax_m: L.strip.hMax,
          box: { x: L.strip.x, y: L.top, width: L.strip.w, height: L.bottom - L.top },
        }
      : null,
    net: {
      centre_m: BWF_NET_HEIGHT.centre,
      sidelines_m: BWF_NET_HEIGHT.sidelines,
      posts_m: BWF_NET_HEIGHT.posts,
      source: 'BWF Statutes Section 4.1, Laws of Badminton, Laws 1.4 and 1.10',
    },
    font: 'built-in vector stroke glyphs (dema.js); no font files or system fonts',
    frames: frames,
  };
}

// ===== SCENE SPEC -> STATE =====
// A scene spec (JSON, metres) describes everything one render needs; see the
// README "DEMA render mode" section. Throws on anything malformed rather than
// guessing, so a bad spec can't silently render something else.
function demaFinite(v, what) {
  const n = Number(v);
  if (v === null || v === '' || !isFinite(n)) throw new Error(what + ' must be a finite number');
  return n;
}

function demaXY(v, what) {
  const x = Array.isArray(v) ? v[0] : v && v.x;
  const y = Array.isArray(v) ? v[1] : v && v.y;
  const c = metresToCourt(demaFinite(x, what + '.x'), demaFinite(y, what + '.y'));
  return { x: svgNum(c.x), y: svgNum(c.y) };
}

function demaSceneToState(spec) {
  if (!spec || !Array.isArray(spec.frames) || spec.frames.length === 0) {
    throw new Error('scene spec needs a non-empty frames array');
  }
  const mode = spec.mode || 'doubles';
  if (mode !== 'singles' && mode !== 'doubles')
    throw new Error("mode must be 'singles' or 'doubles'");
  const frames = spec.frames.map((fr, i) => {
    const f = createEmptyFrame();
    if (fr.t != null) f.t = demaFinite(fr.t, 'frames[' + i + '].t');
    const players = fr.players || {};
    for (const pid in players) {
      if (DEMA_PLAYER_ORDER.indexOf(pid) === -1) {
        throw new Error('frames[' + i + ']: unknown player ' + pid + ' (use A1/A2/B1/B2)');
      }
      f.players[pid] = demaXY(players[pid], 'frames[' + i + '].players.' + pid);
    }
    if (fr.trail != null) f.trail = normalizeShuttleSamples(fr.trail, 'm');
    if (fr.shot) {
      if (!SHOT_COLORS[fr.shot.type])
        throw new Error('frames[' + i + '].shot.type is not a shot type');
      const a = demaXY(fr.shot.from, 'frames[' + i + '].shot.from');
      const b = demaXY(fr.shot.to, 'frames[' + i + '].shot.to');
      f.shot = { type: fr.shot.type, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    return f;
  });
  const playerNames = {};
  const labels = spec.labels || {};
  for (const pid in labels) {
    if (DEMA_PLAYER_ORDER.indexOf(pid) === -1) throw new Error('labels: unknown player ' + pid);
    playerNames[pid] = String(labels[pid]).substring(0, 8);
  }
  const st = {
    mode: 'overlay',
    currentFrame: 0,
    frames: frames,
    title: String(spec.title || ''),
    playerNames: playerNames,
    exportBg: 'dark',
    courtOrientation: 'portrait',
    showShotArrows: spec.arrows === true,
    dema: {
      arrows: spec.arrows === true,
      timestamps: spec.timestamps !== false,
      heightStrip: spec.heightStrip || false,
    },
  };
  if (mode === 'singles') st.gameMode = 'singles';
  ['pxPerMetre', 'playerRadius', 'timeDecimals'].forEach((k) => {
    if (spec[k] != null) st.dema[k] = demaFinite(spec[k], k);
  });
  if (spec.colors) st.dema.colors = Object.assign({}, spec.colors);
  if (spec.shuttle) {
    const samples = Array.isArray(spec.shuttle) ? spec.shuttle : spec.shuttle.samples;
    st.shuttlePath = normalizeShuttleSamples(samples || [], 'm');
    if (spec.shuttle.trailWindow != null) {
      st.trailWindow = demaFinite(spec.shuttle.trailWindow, 'shuttle.trailWindow');
    }
  }
  return st;
}
