// ===== INTERACTIONS =====

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  render();
}

function setTool(t) {
  tool = t;
  shotStart = null; movePlayer = null;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.getElementById('playerSection').style.display = (t === 'player' || t === 'movement') ? '' : 'none';
  document.getElementById('shotSection').style.display = t === 'shot' ? '' : 'none';
  document.getElementById('moveSection').style.display = t === 'movement' ? '' : 'none';
  updateCursor();
  updateStatus();
}

function selectPlayer(id) {
  selectedPlayer = id;
  if (tool !== 'movement' && tool !== 'shot') setTool('player');
  document.querySelectorAll('.player-token').forEach(t => t.classList.toggle('active', t.dataset.player === id));
  render();
}

// Hotkeys
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const keyMap = { '1': 'A1', '2': 'A2', '3': 'B1', '4': 'B2' };
  if (keyMap[e.key]) { selectPlayer(keyMap[e.key]); e.preventDefault(); }
  if (e.key === ' ') { e.preventDefault(); toggleAnimation(); }
  if (e.key === 'Escape') {
    shotStart = null; shotPreviewLine = null; moveDragPlayer = null;
    const modal = document.getElementById('helpModal');
    if (modal) modal.classList.remove('show');
    render();
  }
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  if (e.key === '?') { toggleHelp(); }
  if (e.key === 'd' || e.key === 'D') { if (!e.ctrlKey && !e.metaKey) duplicateFrame(); }
});

function setShotType(t) {
  shotType = t;
  shotStart = null;
  document.querySelectorAll('.shot-btn').forEach(b => b.classList.toggle('active', b.dataset.shot === t));
  updateStatus();
}

function updateCursor() {
  const svg = document.querySelector('.court-svg');
  if (!svg) return;
  svg.classList.remove('tool-player', 'tool-shot', 'tool-movement');
  svg.classList.add('tool-' + tool);
}

function getSVGPoint(evt) {
  const svg = document.querySelector('.court-svg');
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  const touch = evt.touches ? evt.touches[0] : (evt.changedTouches ? evt.changedTouches[0] : evt);
  if (!touch) return null;
  pt.x = touch.clientX;
  pt.y = touch.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return { x: Math.round(pt.matrixTransform(ctm.inverse()).x), y: Math.round(pt.matrixTransform(ctm.inverse()).y) };
}

function isOnCourt(x, y) {
  return x >= PAD && x <= PAD + CW && y >= PAD && y <= PAD + CH;
}

function courtClick(evt) {
  evt.preventDefault();
  if (evt.button === 2) return;
  if (isDragging) { isDragging = false; return; }
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  const f = currentFrameData();

  if (tool === 'player') {
    const nearby = findPlayerAt(p.x, p.y, f);
    if (nearby) { selectPlayer(nearby); return; }
    pushUndo();
    f.players[selectedPlayer] = { x: p.x, y: p.y };
    render();
  } else if (tool === 'movement') {
    const nearby = findPlayerAt(p.x, p.y, f);
    if (nearby) selectPlayer(nearby);
  }
}

function courtClickPanel(evt) {
  evt.preventDefault();
  if (evt.button === 2) return;
  if (isDragging) { isDragging = false; return; }
  const p = getSVGPoint(evt);
  if (!p) return;
  const n = state.frames.length;
  const gap = 20;
  for (let i = 0; i < n; i++) {
    const ox = i * (SW + gap);
    if (p.x >= ox && p.x < ox + SW) {
      if (i !== state.currentFrame) { state.currentFrame = i; render(); return; }
      const localP = { x: p.x - ox, y: p.y - 30 };
      if (!isOnCourt(localP.x, localP.y)) return;
      const f = currentFrameData();
      if (tool === 'player') {
        const nearby = findPlayerAt(localP.x, localP.y, f);
        if (nearby) { selectPlayer(nearby); return; }
        pushUndo();
        f.players[selectedPlayer] = { x: localP.x, y: localP.y };
        render();
      }
      return;
    }
  }
}

// ===== RIGHT-CLICK / LONG-PRESS DELETE =====
function courtRightClick(evt) { evt.preventDefault(); const p = getSVGPoint(evt); if (p) deleteAt(p.x, p.y); }
function courtRightClickPanel(evt) { evt.preventDefault(); courtRightClick(evt); }

function deleteAt(x, y) {
  const f = currentFrameData();
  const player = findPlayerAt(x, y, f);
  if (player) { pushUndo(); delete f.players[player]; delete f.movements[player]; render(); showToast('Player removed'); return true; }
  if (f.shot) {
    const sx = (f.shot.x1 + f.shot.x2) / 2, sy = (f.shot.y1 + f.shot.y2) / 2;
    if (Math.hypot(sx - x, sy - y) < 50) { pushUndo(); f.shot = null; render(); showToast('Shot removed'); return true; }
  }
  for (const pid in f.movements) {
    const m = f.movements[pid];
    if (Math.hypot(m.x - x, m.y - y) < HIT_R) { pushUndo(); delete f.movements[pid]; render(); showToast('Movement removed'); return true; }
  }
  return false;
}

function startLongPress(evt, x, y) {
  clearLongPress();
  longPressTarget = { x, y };
  longPressTimer = setTimeout(() => {
    if (longPressTarget) {
      deleteAt(longPressTarget.x, longPressTarget.y);
      if (navigator.vibrate) navigator.vibrate(50);
    }
    longPressTarget = null;
  }, 600);
}

function clearLongPress() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  longPressTarget = null;
}

// ===== DRAG: Player placement =====
function startDrag(evt, pid) {
  evt.preventDefault();
  evt.stopPropagation();
  const p = getSVGPoint(evt);
  const f = currentFrameData();
  if (!p || !f.players[pid]) return;
  isDragging = false;
  if (evt.touches) startLongPress(evt, p.x, p.y);

  if (tool === 'player') {
    pushUndo();
    dragPlayer = pid;
    selectedPlayer = pid;
    document.querySelectorAll('.player-token').forEach(t => t.classList.toggle('active', t.dataset.player === pid));
    dragOffset = { x: f.players[pid].x - p.x, y: f.players[pid].y - p.y };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  } else if (tool === 'movement') {
    pushUndo();
    moveDragPlayer = pid;
    selectedPlayer = pid;
    document.querySelectorAll('.player-token').forEach(t => t.classList.toggle('active', t.dataset.player === pid));
    moveDragStart = { x: f.players[pid].x, y: f.players[pid].y };
    document.addEventListener('mousemove', onMoveDrag);
    document.addEventListener('mouseup', endMoveDrag);
    document.addEventListener('touchmove', onMoveDrag, { passive: false });
    document.addEventListener('touchend', endMoveDrag);
  }
}

function onDrag(evt) {
  if (!dragPlayer) return;
  evt.preventDefault();
  clearLongPress();
  const p = getSVGPoint(evt);
  if (!p) return;
  isDragging = true;
  const f = currentFrameData();
  const nx = p.x + dragOffset.x, ny = p.y + dragOffset.y;
  if (isOnCourt(nx, ny)) { f.players[dragPlayer] = { x: nx, y: ny }; render(); }
}

function endDrag() {
  clearLongPress();
  dragPlayer = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
  saveState();
}

// ===== DRAG: Movement =====
function onMoveDrag(evt) {
  if (!moveDragPlayer) return;
  evt.preventDefault();
  clearLongPress();
  isDragging = true;
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  currentFrameData().movements[moveDragPlayer] = { x: p.x, y: p.y };
  render();
}

function endMoveDrag() {
  clearLongPress();
  if (moveDragPlayer) {
    const f = currentFrameData();
    if (moveDragStart && f.movements[moveDragPlayer]) {
      const m = f.movements[moveDragPlayer];
      if (Math.hypot(m.x - moveDragStart.x, m.y - moveDragStart.y) < 8) delete f.movements[moveDragPlayer];
    }
    render(); saveState();
  }
  moveDragPlayer = null; moveDragStart = null;
  document.removeEventListener('mousemove', onMoveDrag);
  document.removeEventListener('mouseup', endMoveDrag);
  document.removeEventListener('touchmove', onMoveDrag);
  document.removeEventListener('touchend', endMoveDrag);
}

// ===== DRAG: Shot lines =====
function initShotDrag() {
  const c = document.getElementById('courtContainer');
  c.addEventListener('mousedown', onShotMouseDown);
  c.addEventListener('touchstart', onShotMouseDown, { passive: false });
}

function onShotMouseDown(evt) {
  if (tool !== 'shot' || evt.button === 2) return;
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  evt.preventDefault();

  // Snap shot start to nearest player
  const f = currentFrameData();
  let closest = null, minD = Infinity;
  for (const pid in f.players) {
    const pl = f.players[pid];
    const d = Math.hypot(pl.x - p.x, pl.y - p.y);
    if (d < minD) { minD = d; closest = pid; }
  }
  if (!closest || minD > 120) {
    showToast('Click near a player to start the shot');
    return;
  }

  const origin = f.players[closest];
  pushUndo();
  shotStart = { x: origin.x, y: origin.y, player: closest };
  shotPreviewLine = { x1: origin.x, y1: origin.y, x2: p.x, y2: p.y };
  document.addEventListener('mousemove', onShotDrag);
  document.addEventListener('mouseup', endShotDrag);
  document.addEventListener('touchmove', onShotDrag, { passive: false });
  document.addEventListener('touchend', endShotDrag);
}

function onShotDrag(evt) {
  if (!shotStart) return;
  evt.preventDefault();
  const p = getSVGPoint(evt);
  if (!p) return;
  shotPreviewLine = { x1: shotStart.x, y1: shotStart.y, x2: p.x, y2: p.y };
  render();
}

function endShotDrag(evt) {
  if (!shotStart) return;
  const p = getSVGPoint(evt.changedTouches ? evt.changedTouches[0] : evt);
  if (p && isOnCourt(p.x, p.y) && Math.hypot(p.x - shotStart.x, p.y - shotStart.y) > 15) {
    currentFrameData().shot = { type: shotType, x1: shotStart.x, y1: shotStart.y, x2: p.x, y2: p.y };
  }
  shotStart = null; shotPreviewLine = null;
  document.removeEventListener('mousemove', onShotDrag);
  document.removeEventListener('mouseup', endShotDrag);
  document.removeEventListener('touchmove', onShotDrag);
  document.removeEventListener('touchend', endShotDrag);
  render(); saveState();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ===== HELP MODAL =====
function toggleHelp() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.classList.toggle('show');
}
