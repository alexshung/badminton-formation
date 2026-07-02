// ===== CONSTANTS =====
const CW = 610, CH = 1340;
const PAD = 40;
const SW = CW + PAD * 2, SH = CH + PAD * 2;
const PR = 42;
const HIT_R = 56;
const SHOT_COLORS = { drop: '#ffb347', drive: '#00e676', smash: '#ff5252', clear: '#00bfff', lift: '#b967ff', serve: '#ff79c6' };
const SHOT_LABELS = { drop: 'Drop', drive: 'Drive', smash: 'Smash', clear: 'Clear', lift: 'Lift', serve: 'Serve' };
const TEAM_COLORS = { A: '#00d4ff', B: '#ff6b9d' };
const TEAM_COLORS_DIM = { A: 'rgba(0,212,255,.35)', B: 'rgba(255,107,157,.35)' };
const MAX_UNDO = 20;
const MAX_FRAMES = 8;

// ===== PRESET FORMATIONS =====
const PRESETS = {
  'front-back-attack': {
    label: 'Front-Back Attack',
    players: {
      A1: { x: PAD + CW/2, y: PAD + CH*0.82 },
      A2: { x: PAD + CW/2, y: PAD + CH*0.62 },
      B1: { x: PAD + CW*0.35, y: PAD + CH*0.28 },
      B2: { x: PAD + CW*0.65, y: PAD + CH*0.28 }
    }
  },
  'side-by-side-defense': {
    label: 'Side-by-Side Defense',
    players: {
      A1: { x: PAD + CW*0.3, y: PAD + CH*0.75 },
      A2: { x: PAD + CW*0.7, y: PAD + CH*0.75 },
      B1: { x: PAD + CW/2, y: PAD + CH*0.18 },
      B2: { x: PAD + CW/2, y: PAD + CH*0.35 }
    }
  },
  'rotation-ready': {
    label: 'Rotation Ready',
    players: {
      A1: { x: PAD + CW*0.35, y: PAD + CH*0.72 },
      A2: { x: PAD + CW*0.65, y: PAD + CH*0.82 },
      B1: { x: PAD + CW*0.65, y: PAD + CH*0.18 },
      B2: { x: PAD + CW*0.35, y: PAD + CH*0.28 }
    }
  },
  'service-even': {
    label: 'Service (Even Court)',
    players: {
      A1: { x: PAD + CW*0.5, y: PAD + CH*0.648 },
      A2: { x: PAD + CW*0.45, y: PAD + CH*0.88 },
      B1: { x: PAD + CW*0.5, y: PAD + CH*0.15 },
      B2: { x: PAD + CW*0.4, y: PAD + CH*0.352 }
    }
  },
  'service-odd': {
    label: 'Service (Odd Court)',
    players: {
      A1: { x: PAD + CW*0.4, y: PAD + CH*0.648 },
      A2: { x: PAD + CW*0.5, y: PAD + CH*0.88 },
      B1: { x: PAD + CW*0.35, y: PAD + CH*0.12 },
      B2: { x: PAD + CW*0.6, y: PAD + CH*0.35 }
    }
  },
  'attack-front-back': {
    label: 'Attack (Front-Back)',
    players: {
      A1: { x: PAD + CW*0.5, y: PAD + CH*0.58 },
      A2: { x: PAD + CW*0.5, y: PAD + CH*0.82 },
      B1: { x: PAD + CW*0.35, y: PAD + CH*0.3 },
      B2: { x: PAD + CW*0.65, y: PAD + CH*0.3 }
    }
  },
  'defense-side': {
    label: 'Defense (Side-by-Side)',
    players: {
      A1: { x: PAD + CW*0.3, y: PAD + CH*0.72 },
      A2: { x: PAD + CW*0.7, y: PAD + CH*0.72 },
      B1: { x: PAD + CW*0.5, y: PAD + CH*0.2 },
      B2: { x: PAD + CW*0.5, y: PAD + CH*0.38 }
    }
  },
  'mixed-doubles': {
    label: 'Mixed Doubles',
    players: {
      A1: { x: PAD + CW*0.5, y: PAD + CH*0.56 },
      A2: { x: PAD + CW*0.5, y: PAD + CH*0.85 },
      B1: { x: PAD + CW*0.5, y: PAD + CH*0.15 },
      B2: { x: PAD + CW*0.5, y: PAD + CH*0.42 }
    }
  }
};

// ===== STATE =====
let state = {
  mode: 'overlay',
  currentFrame: 0,
  frames: [createEmptyFrame(), createEmptyFrame(), createEmptyFrame()],
  title: 'Doubles Formation',
  playerNames: {},
  exportBg: 'dark',
  courtOrientation: 'auto'
};

let tool = 'player';
let selectedPlayer = 'A1';
let shotType = 'drop';
let shotStart = null;
let movePlayer = null;
let shotPreviewLine = null;
let moveDragPlayer = null;
let moveDragStart = null;
let drawColor = '#ffffff';
let coveragePoints = [];       // points being drawn for current polygon
let coveragePreview = null;    // {x,y} of mouse for live preview line
let dragPlayer = null, dragOffset = { x: 0, y: 0 };
let isDragging = false;
let longPressTimer = null;
let longPressTarget = null;
let undoStack = [];

function createEmptyFrame() {
  return { players: {}, shot: null, movements: {}, regions: {}, note: '', label: '', annotations: [] };
}

function currentFrameData() { return state.frames[state.currentFrame]; }

function getPlayerLabel(id) {
  return state.playerNames[id] || id;
}

// ===== UNDO =====
function pushUndo() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  updateUndoBtn();
}

function undo() {
  if (undoStack.length === 0) { showToast('Nothing to undo'); return; }
  const prev = JSON.parse(undoStack.pop());
  state = prev;
  document.getElementById('titleInput').value = state.title || 'Doubles Formation';
  render();
  updateUndoBtn();
  showToast('Undone (' + undoStack.length + ' left)');
}

function updateUndoBtn() {
  const btn = document.getElementById('undoBtn');
  const count = document.getElementById('undoCount');
  if (!btn) return;
  btn.disabled = undoStack.length === 0;
  if (count) {
    count.textContent = undoStack.length;
    count.style.display = undoStack.length > 0 ? 'inline-block' : 'none';
  }
}

// ===== PERSISTENCE =====
function saveState() {
  clearTimeout(saveState._t);
  const titleEl = document.getElementById('titleInput');
  if (titleEl) state.title = titleEl.value;
  const json = JSON.stringify(state);
  try { localStorage.setItem('bf-pro-state', json); } catch(e){}
  try { sessionStorage.setItem('bf-pro-state', json); } catch(e){}
  try { window.name = 'BF:' + json; } catch(e){}
}

// Debounced persistence. render() runs on every drag/animation frame, so
// serializing the whole state to three storage backends each time causes jank
// (especially on mobile). Coalesce those writes; explicit saveState() calls
// (mouseup handlers, beforeunload/pagehide) still persist immediately.
function scheduleSave() {
  clearTimeout(saveState._t);
  saveState._t = setTimeout(saveState, 400);
}

function loadState() {
  try {
    let raw = localStorage.getItem('bf-pro-state');
    if (!raw) raw = sessionStorage.getItem('bf-pro-state');
    if (!raw && window.name && window.name.startsWith('BF:')) raw = window.name.slice(3);
    const s = JSON.parse(raw);
    if (s && s.frames) {
      state = s;
      if (!state.playerNames) state.playerNames = {};
      if (!state.exportBg) state.exportBg = 'dark';
      if (!state.courtOrientation) state.courtOrientation = 'auto';
      state.frames.forEach(f => { if (!f.note) f.note = ''; if (!f.regions) f.regions = {}; if (f.label === undefined) f.label = ''; if (!f.annotations) f.annotations = []; });
    }
  } catch(e){}
  const titleEl = document.getElementById('titleInput');
  if (titleEl) titleEl.value = state.title || 'Doubles Formation';
}

window.addEventListener('beforeunload', saveState);
window.addEventListener('pagehide', saveState);

// ===== FRAME MANAGEMENT =====
function switchFrame(i) {
  pushUndo();
  state.currentFrame = i;
  shotStart = null; movePlayer = null; shotPreviewLine = null; moveDragPlayer = null;
  coveragePoints = []; coveragePreview = null;
  if (i > 0) {
    const prev = state.frames[i - 1];
    const curr = state.frames[i];
    if (Object.keys(curr.players).length === 0 && Object.keys(prev.players).length > 0) {
      for (const pid in prev.players) {
        curr.players[pid] = prev.movements[pid] ? { ...prev.movements[pid] } : { ...prev.players[pid] };
      }
    }
    // Inherit regions from previous frame if current has none
    if (Object.keys(curr.regions || {}).length === 0 && Object.keys(prev.regions || {}).length > 0) {
      curr.regions = JSON.parse(JSON.stringify(prev.regions));
    }
  }
  render();
}

function addFrame() {
  if (state.frames.length >= MAX_FRAMES) { showToast('Max ' + MAX_FRAMES + ' frames'); return; }
  pushUndo();
  const prev = state.frames[state.frames.length - 1];
  const nf = createEmptyFrame();
  for (const pid in prev.players) {
    nf.players[pid] = prev.movements[pid] ? { ...prev.movements[pid] } : { ...prev.players[pid] };
  }
  // Inherit regions
  if (prev.regions && Object.keys(prev.regions).length > 0) {
    nf.regions = JSON.parse(JSON.stringify(prev.regions));
  }
  state.frames.push(nf);
  state.currentFrame = state.frames.length - 1;
  render();
}

function duplicateFrame() {
  if (state.frames.length >= MAX_FRAMES) { showToast('Max ' + MAX_FRAMES + ' frames'); return; }
  pushUndo();
  const src = state.frames[state.currentFrame];
  const dup = JSON.parse(JSON.stringify(src));
  state.frames.splice(state.currentFrame + 1, 0, dup);
  state.currentFrame++;
  render();
  showToast('Frame duplicated');
}

// UX UPGRADE: duplicate specific frame (for timeline dup button)
function duplicateFrameAt(i) {
  if (state.frames.length >= MAX_FRAMES) { showToast('Max ' + MAX_FRAMES + ' frames'); return; }
  pushUndo();
  const src = state.frames[i];
  const dup = JSON.parse(JSON.stringify(src));
  state.frames.splice(i + 1, 0, dup);
  state.currentFrame = i + 1;
  render();
  showToast('Frame duplicated');
  if (navigator.vibrate) navigator.vibrate(20);
}

function removeFrame(evt, i) {
  evt.preventDefault();
  evt.stopPropagation();
  if (state.frames.length <= 1) return;
  pushUndo();
  state.frames.splice(i, 1);
  if (state.currentFrame >= state.frames.length) state.currentFrame = state.frames.length - 1;
  render(); saveState();
}

function removeLastFrame() {
  if (state.frames.length <= 1) return;
  pushUndo();
  state.frames.pop();
  if (state.currentFrame >= state.frames.length) state.currentFrame = state.frames.length - 1;
  render(); saveState();
  showToast('Frame ' + (state.frames.length + 1) + ' removed');
}

function clearFrame() {
  pushUndo();
  state.frames[state.currentFrame] = createEmptyFrame();
  render();
}

// UX UPGRADE: clear shot only (hotkey C)
function clearShot() {
  const f = currentFrameData();
  if (f.shot) {
    pushUndo();
    f.shot = null;
    render(); saveState();
    showToast('Shot cleared');
  }
}

function resetAll() {
  if (!confirm('Reset all frames and players?')) return;
  pushUndo();
  state = {
    mode: state.mode, currentFrame: 0,
    frames: [createEmptyFrame(), createEmptyFrame(), createEmptyFrame()],
    title: 'Doubles Formation', playerNames: {}, exportBg: state.exportBg,
    courtOrientation: state.courtOrientation || 'auto'
  };
  document.getElementById('titleInput').value = state.title;
  undoStack = [];
  render();
  updateUndoBtn();
}

// ===== PRESETS =====
function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  pushUndo();
  const f = currentFrameData();
  for (const pid in p.players) {
    f.players[pid] = { x: Math.round(p.players[pid].x), y: Math.round(p.players[pid].y) };
  }
  render();
  showToast(p.label + ' applied');
  if (window.innerWidth <= 1024) closeSidebar();
}

// ===== PLAYER RENAME =====
function renamePlayer(id) {
  const current = state.playerNames[id] || id;
  const name = prompt('Rename player ' + id + ':', current);
  if (name === null) return;
  pushUndo();
  if (name.trim() === '' || name.trim() === id) {
    delete state.playerNames[id];
  } else {
    state.playerNames[id] = name.trim().substring(0, 8);
  }
  render();
}

// ===== UTILITY =====
function findPlayerAt(x, y, frame, maxRadius) {
  const f = frame || currentFrameData();
  const maxR = maxRadius || HIT_R;
  let closest = null, minD = Infinity;
  for (const pid in f.players) {
    const pl = f.players[pid];
    const d = Math.hypot(pl.x - x, pl.y - y);
    if (d < maxR && d < minD) { minD = d; closest = pid; }
  }
  return closest;
}

// ===== SHUTTLE TRACKING =====
function getShuttlePosition(frameIdx) {
  // Walk backwards to find last shot endpoint
  for (let i = frameIdx - 1; i >= 0; i--) {
    if (state.frames[i].shot) {
      return { x: state.frames[i].shot.x2, y: state.frames[i].shot.y2 };
    }
  }
  return null;
}

// ===== POSITION PROPAGATION =====
function propagatePositions(fromFrame) {
  for (let i = fromFrame + 1; i < state.frames.length; i++) {
    const prev = state.frames[i - 1];
    const curr = state.frames[i];
    for (const pid in prev.players) {
      const endPos = prev.movements[pid] ? { ...prev.movements[pid] } : { ...prev.players[pid] };
      curr.players[pid] = endPos;
    }
  }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 1400);
}

// ===== COURT ORIENTATION =====
function isLandscapeCourt() {
  const orient = state.courtOrientation || 'auto';
  if (orient === 'landscape') return true;
  if (orient === 'portrait') return false;
  // auto: landscape when mobile-sized AND device is landscape
  return window.innerWidth <= 1024 && window.innerWidth > window.innerHeight;
}

function toggleCourtOrientation() {
  const current = state.courtOrientation || 'auto';
  if (current === 'auto') state.courtOrientation = 'landscape';
  else if (current === 'landscape') state.courtOrientation = 'portrait';
  else state.courtOrientation = 'auto';
  render();
  saveState();
  const label = isLandscapeCourt() ? 'Landscape' : 'Portrait';
  showToast('Court: ' + label + (state.courtOrientation === 'auto' ? ' (auto)' : ''));
}

// ===== SHAREABLE URL =====
// LZString is loaded from vendor/lz-string.js (see index.html) and exposed as a global.

function shareState() {
  // Build compact representation
  const compact = {
    t: state.title || '',
    f: state.frames.map(f => {
      const cf = {};
      if (Object.keys(f.players).length) cf.p = f.players;
      if (f.shot) cf.s = f.shot;
      if (Object.keys(f.movements).length) cf.m = f.movements;
      if (f.label) cf.l = f.label;
      if (f.note) cf.n = f.note;
      if (f.regions && Object.keys(f.regions).length) cf.r = f.regions;
      if (f.annotations && f.annotations.length) cf.a = f.annotations;
      return cf;
    }),
    pn: Object.keys(state.playerNames).length ? state.playerNames : undefined
  };
  const json = JSON.stringify(compact);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const url = window.location.origin + window.location.pathname + '#s=' + compressed;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('Link copied!'); } catch(e) { showToast('Copy failed'); }
  document.body.removeChild(ta);
}

function loadFromHash() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#s=')) return false;
  try {
    const compressed = hash.substring(3);
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return false;
    const compact = JSON.parse(json);
    state.title = compact.t || 'Doubles Formation';
    state.playerNames = compact.pn || {};
    state.frames = compact.f.map(cf => ({
      players: cf.p || {},
      shot: cf.s || null,
      movements: cf.m || {},
      label: cf.l || '',
      note: cf.n || '',
      regions: cf.r || {},
      annotations: cf.a || []
    }));
    state.currentFrame = 0;
    const titleEl = document.getElementById('titleInput');
    if (titleEl) titleEl.value = state.title;
    // Clear hash to prevent re-loading on refresh (user can re-share)
    history.replaceState(null, '', window.location.pathname);
    return true;
  } catch(e) { console.warn('Failed to load from URL:', e); return false; }
}
