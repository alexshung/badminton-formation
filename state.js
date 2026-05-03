// ===== CONSTANTS =====
const CW = 610, CH = 1340;
const PAD = 40;
const SW = CW + PAD * 2, SH = CH + PAD * 2;
const PR = 42;
const HIT_R = 56;
const SHOT_COLORS = { drop: '#ff9f43', drive: '#feca57', smash: '#ee5a24', clear: '#2ed573', lift: '#a29bfe', serve: '#fd79a8' };
const SHOT_LABELS = { drop: 'Drop', drive: 'Drive', smash: 'Smash', clear: 'Clear', lift: 'Lift', serve: 'Serve' };
const TEAM_COLORS = { A: '#4a9eff', B: '#ff6b6b' };
const TEAM_COLORS_DIM = { A: 'rgba(74,158,255,.35)', B: 'rgba(255,107,107,.35)' };
const MAX_UNDO = 20;

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
let coveragePoints = [];       // points being drawn for current polygon
let coveragePreview = null;    // {x,y} of mouse for live preview line
let dragPlayer = null, dragOffset = { x: 0, y: 0 };
let isDragging = false;
let longPressTimer = null;
let longPressTarget = null;
let undoStack = [];

function createEmptyFrame() {
  return { players: {}, shot: null, movements: {}, regions: {}, note: '' };
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
  const titleEl = document.getElementById('titleInput');
  if (titleEl) state.title = titleEl.value;
  const json = JSON.stringify(state);
  try { localStorage.setItem('bf-pro-state', json); } catch(e){}
  try { sessionStorage.setItem('bf-pro-state', json); } catch(e){}
  try { window.name = 'BF:' + json; } catch(e){}
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
      state.frames.forEach(f => { if (!f.note) f.note = ''; if (!f.regions) f.regions = {}; if (f.label === undefined) f.label = ''; });
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
  if (state.frames.length >= 6) return;
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
  if (state.frames.length >= 6) { showToast('Max 6 frames'); return; }
  pushUndo();
  const src = state.frames[state.currentFrame];
  const dup = JSON.parse(JSON.stringify(src));
  state.frames.splice(state.currentFrame + 1, 0, dup);
  state.currentFrame++;
  render();
  showToast('Frame duplicated');
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

function resetAll() {
  if (!confirm('Reset all frames and players?')) return;
  pushUndo();
  state = {
    mode: state.mode, currentFrame: 0,
    frames: [createEmptyFrame(), createEmptyFrame(), createEmptyFrame()],
    title: 'Doubles Formation', playerNames: {}, exportBg: state.exportBg
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
// LZString (MIT) — minimal UTF16 compress/decompress
var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(n){return null==n?"":""==n?null:(n=n.replace(/ /g,"+"),i._decompress(n.length,32,function(r){return o(e,n.charAt(r))}))},_compress:function(o,n,e){if(null==o)return"";var t,i,s,u={},f={},a="",p="",c="",l=2,d=3,g=2,h=[],v=0,m=0;for(s=0;s<o.length;s+=1)if(a=o.charAt(s),Object.prototype.hasOwnProperty.call(u,a)||(u[a]=d++,f[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(u,p))c=p;else{if(Object.prototype.hasOwnProperty.call(f,c)){if(c.charCodeAt(0)<256){for(t=0;t<g;t++)v<<=1,m==n-1?(m=0,h.push(e(v)),v=0):m++;for(i=c.charCodeAt(0),t=0;t<8;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1}else{for(i=1,t=0;t<g;t++)v=v<<1|i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i=0;for(i=c.charCodeAt(0),t=0;t<16;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1}0==--l&&(l=Math.pow(2,g),g++),delete f[c]}else for(i=u[c],t=0;t<g;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1;0==--l&&(l=Math.pow(2,g),g++),u[p]=d++,c=a}if(""!==c){if(Object.prototype.hasOwnProperty.call(f,c)){if(c.charCodeAt(0)<256){for(t=0;t<g;t++)v<<=1,m==n-1?(m=0,h.push(e(v)),v=0):m++;for(i=c.charCodeAt(0),t=0;t<8;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1}else{for(i=1,t=0;t<g;t++)v=v<<1|i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i=0;for(i=c.charCodeAt(0),t=0;t<16;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1}0==--l&&(l=Math.pow(2,g),g++),delete f[c]}else for(i=u[c],t=0;t<g;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1;0==--l&&(l=Math.pow(2,g),g++)}for(i=2,t=0;t<g;t++)v=v<<1|1&i,m==n-1?(m=0,h.push(e(v)),v=0):m++,i>>=1;for(;;){if(v<<=1,m==n-1){h.push(e(v));break}m++}return h.join("")},_decompress:function(o,n,e){var t,i,s,u,f,a,p,c=[],l=4,d=4,g=3,h="",v=[],m={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)c[t]=t;for(s=0,f=Math.pow(2,2),a=1;a!=f;)u=m.val&m.position,m.position>>=1,0==m.position&&(m.position=n,m.val=e(m.index++)),s|=(u>0?1:0)*a,a<<=1;switch(s){case 0:for(s=0,f=Math.pow(2,8),a=1;a!=f;)u=m.val&m.position,m.position>>=1,0==m.position&&(m.position=n,m.val=e(m.index++)),s|=(u>0?1:0)*a,a<<=1;p=r(s);break;case 1:for(s=0,f=Math.pow(2,16),a=1;a!=f;)u=m.val&m.position,m.position>>=1,0==m.position&&(m.position=n,m.val=e(m.index++)),s|=(u>0?1:0)*a,a<<=1;p=r(s);break;case 2:return""}for(c[3]=p,i=p,v.push(p);;){if(m.index>o)return"";for(s=0,f=Math.pow(2,g),a=1;a!=f;)u=m.val&m.position,m.position>>=1,0==m.position&&(m.position=n,m.val=e(m.index++)),s|=(u>0?1:0)*a,a<<=1;switch(p=s){case 0:for(s=0,f=Math.pow(2,8),a=1;a!=f;)u=m.val&m.position,m.position>>=1,0==m.position&&(m.position=n,m.val=e(m.index++)),s|=(u>0?1:0)*a,a<<=1;c[d++]=r(s),p=d-1,l--;break;case 1:for(s=0,f=Math.pow(2,16),a=1;a!=f;)u=m.val&m.position,m.position>>=1,0==m.position&&(m.position=n,m.val=e(m.index++)),s|=(u>0?1:0)*a,a<<=1;c[d++]=r(s),p=d-1,l--;break;case 2:return v.join("")}if(0==l&&(l=Math.pow(2,g),g++),c[p])h=c[p];else{if(p!==d)return null;h=i+i.charAt(0)}v.push(h),c[d++]=i+h.charAt(0),i=h,0==--l&&(l=Math.pow(2,g),g++)}}};return i}();

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
      regions: cf.r || {}
    }));
    state.currentFrame = 0;
    const titleEl = document.getElementById('titleInput');
    if (titleEl) titleEl.value = state.title;
    // Clear hash to prevent re-loading on refresh (user can re-share)
    history.replaceState(null, '', window.location.pathname);
    return true;
  } catch(e) { console.warn('Failed to load from URL:', e); return false; }
}
