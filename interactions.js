// ===== INTERACTIONS =====

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  render();
}

function setTool(t) {
  tool = t;
  shotStart = null; movePlayer = null;
  coveragePoints = []; coveragePreview = null;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.getElementById('playerSection').style.display = (t === 'player' || t === 'coverage') ? '' : 'none';
  document.getElementById('shotSection').style.display = t === 'shot' ? '' : 'none';
  document.getElementById('moveSection').style.display = 'none';
  document.getElementById('coverageSection').style.display = t === 'coverage' ? '' : 'none';
  updateCoverageInfo();
  updateCursor();
  updateStatus();
  updateMobileToolBtns();
  // Auto-close sidebar on mobile — but NOT for shot (wait for shot type pick)
  if (window.innerWidth <= 1024 && t !== 'shot') closeSidebar();
}

function selectPlayer(id) {
  selectedPlayer = id;
  if (tool !== 'shot' && tool !== 'coverage') setTool('player');
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
    coveragePoints = []; coveragePreview = null;
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
  updateMobileToolBtns();
  if (window.innerWidth <= 1024) closeSidebar();
}

// Mobile topbar tool toggle
const SHOT_CYCLE = ['drop', 'drive', 'smash', 'clear', 'lift', 'serve'];

function setToolMobile(t) {
  if (t === 'shot' && tool === 'shot') {
    // Already on shot — cycle through shot types
    const idx = SHOT_CYCLE.indexOf(shotType);
    const next = SHOT_CYCLE[(idx + 1) % SHOT_CYCLE.length];
    setShotType(next);
    showToast(SHOT_LABELS[next]);
    return;
  }
  setTool(t);
  updateMobileToolBtns();
}

function updateMobileToolBtns() {
  const moveBtn = document.getElementById('toolMoveBtn');
  const shotBtn = document.getElementById('toolShotBtn');
  if (moveBtn) moveBtn.classList.toggle('active', tool === 'player');
  if (shotBtn) shotBtn.classList.toggle('active', tool === 'shot');
  // Update shot type color dot
  const dot = document.getElementById('shotTypeDot');
  if (dot) dot.style.background = SHOT_COLORS[shotType] || '#fff';
}

function updateCursor() {
  const svg = document.querySelector('.court-svg');
  if (!svg) return;
  svg.classList.remove('tool-player', 'tool-shot', 'tool-movement', 'tool-coverage');
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
  const svgP = pt.matrixTransform(ctm.inverse());

  const isLand = isLandscapeCourt();

  // In panel mode, adjust coordinates relative to current frame's panel
  if (state.mode === 'panel') {
    const gap = 20;
    const courtW = isLand ? SH : SW;
    const ox = state.currentFrame * (courtW + gap);
    const localX = svgP.x - ox;
    const localY = svgP.y - 30;
    if (isLand) {
      // Inverse of translate(SH,0) rotate(90): origX = localY, origY = SH - localX
      return { x: Math.round(localY), y: Math.round(SH - localX) };
    }
    return { x: Math.round(localX), y: Math.round(localY) };
  }

  if (isLand) {
    // Inverse of translate(SH,0) rotate(90): origX = svgP.y, origY = SH - svgP.x
    return { x: Math.round(svgP.y), y: Math.round(SH - svgP.x) };
  }
  return { x: Math.round(svgP.x), y: Math.round(svgP.y) };
}

// Helper to get raw SVG point without panel adjustment (for frame detection)
function getRawSVGPoint(evt) {
  const svg = document.querySelector('.court-svg');
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  const touch = evt.touches ? evt.touches[0] : (evt.changedTouches ? evt.changedTouches[0] : evt);
  if (!touch) return null;
  pt.x = touch.clientX;
  pt.y = touch.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const svgP = pt.matrixTransform(ctm.inverse());
  return { x: Math.round(svgP.x), y: Math.round(svgP.y) };
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
    if (nearby) {
      // Tapping on a player selects them
      selectPlayer(nearby);
      return;
    }
    if (state.currentFrame === 0) {
      // Frame 1: tap empty court = place player
      pushUndo();
      f.players[selectedPlayer] = { x: p.x, y: p.y };
      propagatePositions(state.currentFrame);
      render();
    }
    // Frame 2+: tap empty court does nothing (drag players to move)
  } else if (tool === 'shot') {
    // Check for shuttle position (previous shot's landing)
    const shuttle = getShuttlePosition(state.currentFrame);

    if (shuttle && !shotStart) {
      // Auto-origin from shuttle: single tap places the shot
      pushUndo();
      f.shot = { type: shotType, x1: shuttle.x, y1: shuttle.y, x2: p.x, y2: p.y };
      render(); saveState();
      showToast('Shot placed');
      return;
    }

    // Two-tap mode (no shuttle, or already in two-tap)
    if (shotStart) {
      if (Math.hypot(p.x - shotStart.x, p.y - shotStart.y) > 15) {
        f.shot = { type: shotType, x1: shotStart.x, y1: shotStart.y, x2: p.x, y2: p.y };
        shotStart = null; shotPreviewLine = null;
        render(); saveState();
        showToast('Shot placed');
      }
      return;
    }

    // First tap: find origin at nearest player
    let closest = null, minD = Infinity;
    for (const pid in f.players) {
      const pl = f.players[pid];
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (d < minD) { minD = d; closest = pid; }
    }
    if (!closest) {
      showToast('Place players first');
      return;
    }
    pushUndo();
    const origin = f.players[closest];
    shotStart = { x: origin.x, y: origin.y };
    render();
    showToast('Now tap the landing spot');
  } else if (tool === 'coverage') {
    handleCoverageClick(p.x, p.y);
  }
}

function courtClickPanel(evt) {
  evt.preventDefault();
  if (evt.button === 2) return;
  if (isDragging) { isDragging = false; return; }
  // Detect which frame panel was clicked using raw coordinates
  const rawP = getRawSVGPoint(evt);
  if (!rawP) return;
  const n = state.frames.length;
  const gap = 20;
  const courtW = isLandscapeCourt() ? SH : SW;
  for (let i = 0; i < n; i++) {
    const ox = i * (courtW + gap);
    if (rawP.x >= ox && rawP.x < ox + courtW) {
      if (i !== state.currentFrame) { state.currentFrame = i; render(); return; }
      break;
    }
  }
  // Delegate to courtClick — getSVGPoint already adjusts for panel offset
  courtClick(evt);
}

// ===== RIGHT-CLICK / LONG-PRESS DELETE =====
function courtRightClick(evt) { evt.preventDefault(); const p = getSVGPoint(evt); if (p) deleteAt(p.x, p.y); }
function courtRightClickPanel(evt) { evt.preventDefault(); courtRightClick(evt); }

function deleteAt(x, y) {
  const f = currentFrameData();
  const player = findPlayerAt(x, y, f);
  if (player) { pushUndo(); delete f.players[player]; delete f.movements[player]; propagatePositions(state.currentFrame); render(); showToast('Player removed'); return true; }
  if (f.shot) {
    const sx = (f.shot.x1 + f.shot.x2) / 2, sy = (f.shot.y1 + f.shot.y2) / 2;
    if (Math.hypot(sx - x, sy - y) < 50) { pushUndo(); f.shot = null; render(); showToast('Shot removed'); return true; }
  }
  for (const pid in f.movements) {
    const m = f.movements[pid];
    if (Math.hypot(m.x - x, m.y - y) < HIT_R) { pushUndo(); delete f.movements[pid]; propagatePositions(state.currentFrame); render(); showToast('Movement removed'); return true; }
  }
  // Check if click is inside a coverage region
  if (f.regions) {
    for (const pid in f.regions) {
      const pts = f.regions[pid];
      if (pts && pts.length >= 3 && isPointInPolygon(x, y, pts)) {
        pushUndo(); delete f.regions[pid]; render(); updateCoverageInfo(); showToast('Coverage removed'); return true;
      }
    }
  }
  return false;
}

function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
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
  selectedPlayer = pid;
  document.querySelectorAll('.player-token').forEach(t => t.classList.toggle('active', t.dataset.player === pid));

  if (evt.touches) startLongPress(evt, p.x, p.y);

  if (state.currentFrame === 0) {
    // Frame 1: drag repositions the player's base position
    pushUndo();
    dragPlayer = pid;
    dragOffset = { x: f.players[pid].x - p.x, y: f.players[pid].y - p.y };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  } else {
    // Frame 2+: drag creates movement arrow
    pushUndo();
    moveDragPlayer = pid;
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
  if (dragPlayer) propagatePositions(state.currentFrame);
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
    propagatePositions(state.currentFrame);
    render(); saveState();
  }
  moveDragPlayer = null; moveDragStart = null;
  document.removeEventListener('mousemove', onMoveDrag);
  document.removeEventListener('mouseup', endMoveDrag);
  document.removeEventListener('touchmove', onMoveDrag);
  document.removeEventListener('touchend', endMoveDrag);
}

// ===== DRAG: Shot adjustment (both origin and endpoint) =====
let shotDragEnd = null; // 'start' or 'end'

function startShuttleDrag(evt) {
  // Desktop mouse handler for shuttlecock endpoint
  evt.preventDefault();
  evt.stopPropagation();
  const f = currentFrameData();
  if (!f.shot) return;
  shotDragEnd = 'end';
  pushUndo();
  document.addEventListener('mousemove', onShotAdjustDrag);
  document.addEventListener('mouseup', endShotAdjustDrag);
}

function onShotAdjustDrag(evt) {
  if (!shotDragEnd) return;
  evt.preventDefault();
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  const f = currentFrameData();
  if (!f.shot) return;
  if (shotDragEnd === 'end') {
    f.shot.x2 = p.x;
    f.shot.y2 = p.y;
  } else {
    f.shot.x1 = p.x;
    f.shot.y1 = p.y;
  }
  render();
}

function endShotAdjustDrag() {
  shotDragEnd = null;
  document.removeEventListener('mousemove', onShotAdjustDrag);
  document.removeEventListener('mouseup', endShotAdjustDrag);
  document.removeEventListener('touchmove', onShotAdjustDrag);
  document.removeEventListener('touchend', endShotAdjustDrag);
  render(); saveState();
}

// ===== DRAG: Shot lines =====
function initShotDrag() {
  const c = document.getElementById('courtContainer');
  // Mouse only — touch shots handled by courtClick (two-tap) and touch delegation
  c.addEventListener('mousedown', onShotMouseDown);
}

function onShotMouseDown(evt) {
  if (tool !== 'shot' || evt.button === 2) return;
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  evt.preventDefault();

  // Two-tap mode: if shotStart already set from a previous tap, this completes the shot
  if (shotStart && Math.hypot(p.x - shotStart.x, p.y - shotStart.y) > 15) {
    currentFrameData().shot = { type: shotType, x1: shotStart.x, y1: shotStart.y, x2: p.x, y2: p.y };
    shotStart = null; shotPreviewLine = null;
    render(); saveState();
    showToast('Shot placed');
    return;
  }

  // Check for shuttle position first, then snap to nearest player
  const f = currentFrameData();
  const shuttle = getShuttlePosition(state.currentFrame);
  let originX, originY;

  if (shuttle) {
    originX = shuttle.x;
    originY = shuttle.y;
  } else {
    let closest = null, minD = Infinity;
    for (const pid in f.players) {
      const pl = f.players[pid];
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (d < minD) { minD = d; closest = pid; }
    }
    if (!closest) {
      showToast('Place players first, then draw shots');
      return;
    }
    const origin = f.players[closest];
    originX = origin.x;
    originY = origin.y;
  }

  pushUndo();
  shotStart = { x: originX, y: originY };
  shotPreviewLine = { x1: originX, y1: originY, x2: p.x, y2: p.y };
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
  const p = getSVGPoint(evt);
  
  // Always remove drag listeners
  document.removeEventListener('mousemove', onShotDrag);
  document.removeEventListener('mouseup', endShotDrag);
  document.removeEventListener('touchmove', onShotDrag);
  document.removeEventListener('touchend', endShotDrag);
  
  if (p && isOnCourt(p.x, p.y) && Math.hypot(p.x - shotStart.x, p.y - shotStart.y) > 15) {
    // Drag was long enough — place the shot
    currentFrameData().shot = { type: shotType, x1: shotStart.x, y1: shotStart.y, x2: p.x, y2: p.y };
    shotStart = null; shotPreviewLine = null;
    showToast('Shot placed');
  } else {
    // Drag too short — enter two-tap mode: keep shotStart, tap again for endpoint
    shotPreviewLine = null;
    showToast('Now tap the landing spot');
  }
  render(); saveState();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isOpen = sb.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('show', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (backdrop) backdrop.classList.remove('show');
}

// ===== HELP MODAL =====
function toggleHelp() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.classList.toggle('show');
}

// ===== COVERAGE REGION DRAWING =====

function handleCoverageClick(x, y) {
  // If already have 3+ points and click near first point, close the polygon
  if (coveragePoints.length >= 3) {
    const first = coveragePoints[0];
    if (Math.hypot(x - first.x, y - first.y) < 20) {
      finishCoverage();
      return;
    }
  }

  // Check if player already has a region — clicking starts a new one (replaces)
  const f = currentFrameData();
  if (coveragePoints.length === 0 && f.regions && f.regions[selectedPlayer]) {
    pushUndo();
    delete f.regions[selectedPlayer];
  }

  coveragePoints.push({ x, y });
  render();
}

function finishCoverage() {
  if (coveragePoints.length < 3) {
    coveragePoints = [];
    coveragePreview = null;
    render();
    return;
  }
  pushUndo();
  const f = currentFrameData();
  if (!f.regions) f.regions = {};
  f.regions[selectedPlayer] = [...coveragePoints];
  coveragePoints = [];
  coveragePreview = null;
  render();
  updateCoverageInfo();
  showToast(getPlayerLabel(selectedPlayer) + ' coverage region set');
}

function clearCoverage(pid) {
  const f = currentFrameData();
  if (f.regions && f.regions[pid]) {
    pushUndo();
    delete f.regions[pid];
    render();
    updateCoverageInfo();
    showToast(getPlayerLabel(pid) + ' coverage cleared');
  }
}

function clearAllCoverage() {
  const f = currentFrameData();
  if (f.regions && Object.keys(f.regions).length > 0) {
    pushUndo();
    f.regions = {};
    render();
    updateCoverageInfo();
    showToast('All coverage cleared');
  }
}

function updateCoverageInfo() {
  const el = document.getElementById('coverageInfo');
  if (!el) return;
  const f = currentFrameData();
  const regions = f.regions || {};
  let html = '';
  const pids = ['A1', 'A2', 'B1', 'B2'];
  for (const pid of pids) {
    const has = regions[pid] && regions[pid].length >= 3;
    const team = pid[0];
    const color = TEAM_COLORS[team];
    const label = getPlayerLabel(pid);
    const selected = pid === selectedPlayer ? ' coverage-active' : '';
    html += `<div class="coverage-player${selected}" onclick="selectPlayer('${pid}')">`;
    html += `<span class="coverage-dot" style="background:${color}"></span>`;
    html += `<span class="coverage-name">${escapeXML(label)}</span>`;
    if (has) {
      html += `<span class="coverage-status">✓</span>`;
      html += `<button class="coverage-clear" onclick="event.stopPropagation();clearCoverage('${pid}')" title="Clear region">✕</button>`;
    } else {
      html += `<span class="coverage-status empty">—</span>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

// Coverage mousemove for live preview
function initCoverageTracking() {
  const c = document.getElementById('courtContainer');
  c.addEventListener('mousemove', function(evt) {
    if (tool !== 'coverage' || coveragePoints.length === 0) return;
    const p = getSVGPoint(evt);
    if (p) { coveragePreview = { x: p.x, y: p.y }; render(); }
  });
  c.addEventListener('dblclick', function(evt) {
    if (tool !== 'coverage' || coveragePoints.length < 3) return;
    evt.preventDefault();
    finishCoverage();
  });
}

// ===== TOUCH DELEGATION (mobile) =====
// Single touchstart on the container — replaces unreliable inline SVG touch events.
// Uses larger hit radius because SVG coordinates map to tiny screen pixels on mobile.

const TOUCH_HIT_R = 180; // ~36px on screen at landscape scale

function initTouchDelegation() {
  const c = document.getElementById('courtContainer');

  c.addEventListener('touchstart', function(evt) {
    const p = getSVGPoint(evt);
    if (!p || !isOnCourt(p.x, p.y)) return;

    const f = currentFrameData();

    // 1. Check if touching a shot endpoint or origin (for adjustment)
    if (f.shot) {
      const dEnd = Math.hypot(p.x - f.shot.x2, p.y - f.shot.y2);
      const dStart = Math.hypot(p.x - f.shot.x1, p.y - f.shot.y1);

      if (dEnd < TOUCH_HIT_R && dEnd < dStart) {
        // Dragging shot endpoint (shuttlecock)
        evt.preventDefault();
        shotDragEnd = 'end';
        pushUndo();
        document.addEventListener('touchmove', onShotAdjustDrag, { passive: false });
        document.addEventListener('touchend', endShotAdjustDrag);
        return;
      }
      if (dStart < TOUCH_HIT_R) {
        // Dragging shot origin
        evt.preventDefault();
        shotDragEnd = 'start';
        pushUndo();
        document.addEventListener('touchmove', onShotAdjustDrag, { passive: false });
        document.addEventListener('touchend', endShotAdjustDrag);
        return;
      }
    }

    // 2. Check if touching a player (large touch radius)
    const nearPlayer = findPlayerAt(p.x, p.y, f, TOUCH_HIT_R);
    if (nearPlayer) {
      evt.preventDefault();
      selectedPlayer = nearPlayer;
      isDragging = false;
      document.querySelectorAll('.player-token').forEach(t => t.classList.toggle('active', t.dataset.player === nearPlayer));

      if (state.currentFrame === 0) {
        // Frame 1: reposition
        pushUndo();
        dragPlayer = nearPlayer;
        dragOffset = { x: f.players[nearPlayer].x - p.x, y: f.players[nearPlayer].y - p.y };
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
      } else {
        // Frame 2+: movement arrow
        pushUndo();
        moveDragPlayer = nearPlayer;
        moveDragStart = { x: f.players[nearPlayer].x, y: f.players[nearPlayer].y };
        document.addEventListener('touchmove', onMoveDrag, { passive: false });
        document.addEventListener('touchend', endMoveDrag);
      }
      return;
    }

    // 3. Empty court — do NOT preventDefault, let click event fire for courtClick
    //    courtClick handles shot placement (two-tap / single-tap)
  }, { passive: false });
}
