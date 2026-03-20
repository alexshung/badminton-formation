// ===== CONSTANTS =====
const CW = 610, CH = 1340; // court dims in "units" (6.1m x 13.4m scaled by 100)
const PAD = 40; // padding around court in SVG
const SW = CW + PAD * 2, SH = CH + PAD * 2; // SVG viewBox size
const PR = 26; // player circle radius
const SHOT_COLORS = { drop: '#F97316', drive: '#EAB308', smash: '#DC2626', clear: '#22C55E' };
const SHOT_LABELS = { drop: 'Drop', drive: 'Drive', smash: 'Smash', clear: 'Clear' };
const TEAM_COLORS = { A: '#3B82F6', B: '#EF4444' };

// ===== STATE =====
let state = {
  mode: 'overlay',
  currentFrame: 0,
  frames: [createEmptyFrame(), createEmptyFrame(), createEmptyFrame()],
  title: 'Doubles Formation'
};

let tool = 'player'; // player | shot | movement
let selectedPlayer = 'A1';
let shotType = 'drop';
let shotStart = null; // temp: first click for shot
let movePlayer = null; // temp: player selected for movement

// Shot preview line and Movement drag state
let shotPreviewLine = null; // {x1,y1,x2,y2} while dragging shot
let moveDragPlayer = null; // player being dragged for movement
let moveDragStart = null; // original position of player being moved

// Drag state
let dragPlayer = null, dragOffset = { x: 0, y: 0 };

function createEmptyFrame() {
  return { players: {}, shot: null, movements: {} };
  // players: { A1: {x,y}, A2: {x,y}, B1: {x,y}, B2: {x,y} }
  // shot: { type, x1, y1, x2, y2 } or null
  // movements: { A1: {x,y}, ... } destination positions
}

function currentFrameData() { return state.frames[state.currentFrame]; }

// ===== PERSISTENCE =====
function saveState() {
  state.title = document.getElementById('titleInput').value;
  const json = JSON.stringify(state);
  try { localStorage.setItem('artifact-badminton-formations', json); } catch (e) { }
  try { sessionStorage.setItem('artifact-badminton-formations', json); } catch (e) { }
  try { window.name = 'BF:' + json; } catch (e) { } // survives same-tab navigation
}

function loadState() {
  try {
    let raw = localStorage.getItem('artifact-badminton-formations');
    if (!raw) raw = sessionStorage.getItem('artifact-badminton-formations');
    if (!raw && window.name && window.name.startsWith('BF:')) raw = window.name.slice(3);
    const s = JSON.parse(raw);
    if (s && s.frames) { state = s; }
  } catch (e) { }
  document.getElementById('titleInput').value = state.title || 'Doubles Formation';
}

// Save before navigating away
window.addEventListener('beforeunload', saveState);
window.addEventListener('pagehide', saveState);

// ===== FRAME MANAGEMENT =====
function switchFrame(i) {
  state.currentFrame = i;
  shotStart = null;
  movePlayer = null;
  shotPreviewLine = null;
  moveDragPlayer = null;
  // Inherit player positions from previous frame's end state if this frame has no players
  if (i > 0) {
    const prev = state.frames[i - 1];
    const curr = state.frames[i];
    if (Object.keys(curr.players).length === 0 && Object.keys(prev.players).length > 0) {
      for (const pid in prev.players) {
        if (prev.movements[pid]) {
          curr.players[pid] = { ...prev.movements[pid] };
        } else {
          curr.players[pid] = { ...prev.players[pid] };
        }
      }
    }
  }
  render();
}

function addFrame() {
  if (state.frames.length >= 6) return;
  // New frame inherits player positions from end of previous frame
  const prev = state.frames[state.frames.length - 1];
  const nf = createEmptyFrame();
  for (const pid in prev.players) {
    if (prev.movements[pid]) {
      nf.players[pid] = { ...prev.movements[pid] };
    } else {
      nf.players[pid] = { ...prev.players[pid] };
    }
  }
  state.frames.push(nf);
  state.currentFrame = state.frames.length - 1;
  render();
}

function removeFrame(evt, i) {
  evt.preventDefault();
  if (state.frames.length <= 1) return;
  state.frames.splice(i, 1);
  if (state.currentFrame >= state.frames.length) state.currentFrame = state.frames.length - 1;
  render();
}

function clearFrame() {
  state.frames[state.currentFrame] = createEmptyFrame();
  render();
}

function resetAll() {
  if (!confirm('Reset everything?')) return;
  state = {
    mode: state.mode, currentFrame: 0,
    frames: [createEmptyFrame(), createEmptyFrame(), createEmptyFrame()],
    title: 'Doubles Formation'
  };
  document.getElementById('titleInput').value = state.title;
  render();
}
