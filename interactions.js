// ===== INTERACTIONS =====

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === m);
  });
  render();
}

function setTool(t) {
  tool = t;
  shotStart = null;
  movePlayer = null;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.getElementById('playerSection').style.display = t === 'player' ? '' : 'none';
  document.getElementById('shotSection').style.display = t === 'shot' ? '' : 'none';
  document.getElementById('moveSection').style.display = t === 'movement' ? '' : 'none';
  updateStatus();
}

function selectPlayer(id) {
  selectedPlayer = id;
  setTool('player');
  document.querySelectorAll('.player-token').forEach(t => t.classList.toggle('active', t.dataset.player === id));
}

// Hotkeys: 1-4 for players, Space for play/pause
document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const keyMap = { '1': 'A1', '2': 'A2', '3': 'B1', '4': 'B2' };
  if (keyMap[e.key]) { selectPlayer(keyMap[e.key]); e.preventDefault(); }
  if (e.key === ' ') { e.preventDefault(); toggleAnimation(); }
});

function setShotType(t) {
  shotType = t;
  shotStart = null;
  document.querySelectorAll('.shot-btn').forEach(b => b.classList.toggle('active', b.dataset.shot === t));
  updateStatus();
}

function getSVGPoint(evt) {
  const svg = document.querySelector('.court-svg');
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  const touch = evt.touches ? evt.touches[0] : evt;
  pt.x = touch.clientX;
  pt.y = touch.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: Math.round(svgP.x), y: Math.round(svgP.y) };
}

function isOnCourt(x, y) {
  return x >= PAD && x <= PAD + CW && y >= PAD && y <= PAD + CH;
}

function courtClick(evt) {
  evt.preventDefault();
  if (evt.button === 2) return;
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  const f = currentFrameData();

  if (tool === 'player') {
    f.players[selectedPlayer] = { x: p.x, y: p.y };
    render();
  }
}

function courtClickPanel(evt) {
  evt.preventDefault();
  if (evt.button === 2) return;
  const p = getSVGPoint(evt);
  if (!p) return;
  const n = state.frames.length;
  const gap = 20;
  for (let i = 0; i < n; i++) {
    const ox = i * (SW + gap);
    if (p.x >= ox && p.x < ox + SW) {
      if (i !== state.currentFrame) {
        state.currentFrame = i;
        render();
        return;
      }
      const localP = { x: p.x - ox, y: p.y - 30 };
      if (!isOnCourt(localP.x, localP.y)) return;
      const f = currentFrameData();
      if (tool === 'player') {
        f.players[selectedPlayer] = { x: localP.x, y: localP.y };
        render();
      } else if (tool === 'shot') {
        if (!shotStart) {
          shotStart = { x: localP.x, y: localP.y };
          updateStatus();
        } else {
          f.shot = { type: shotType, x1: shotStart.x, y1: shotStart.y, x2: localP.x, y2: localP.y };
          shotStart = null;
          render();
        }
      } else if (tool === 'movement') {
        if (!movePlayer) {
          let closest = null, minD = Infinity;
          for (const pid in f.players) {
            const pl = f.players[pid];
            const d = Math.hypot(pl.x - localP.x, pl.y - localP.y);
            if (d < minD && d < 40) { minD = d; closest = pid; }
          }
          if (closest) { movePlayer = closest; updateStatus(); }
        } else {
          f.movements[movePlayer] = { x: localP.x, y: localP.y };
          movePlayer = null;
          render();
        }
      }
      return;
    }
  }
}

function courtRightClick(evt) {
  evt.preventDefault();
  const p = getSVGPoint(evt);
  if (!p) return;
  const f = currentFrameData();
  for (const pid in f.players) {
    const pl = f.players[pid];
    if (Math.hypot(pl.x - p.x, pl.y - p.y) < 30) {
      delete f.players[pid];
      delete f.movements[pid];
      render();
      showDeleteHint();
      return;
    }
  }
  if (f.shot) {
    const sx = (f.shot.x1 + f.shot.x2) / 2, sy = (f.shot.y1 + f.shot.y2) / 2;
    if (Math.hypot(sx - p.x, sy - p.y) < 40) {
      f.shot = null;
      render();
      showDeleteHint();
      return;
    }
  }
  for (const pid in f.movements) {
    const m = f.movements[pid];
    if (Math.hypot(m.x - p.x, m.y - p.y) < 30) {
      delete f.movements[pid];
      render();
      showDeleteHint();
      return;
    }
  }
}

function courtRightClickPanel(evt) {
  evt.preventDefault();
  courtRightClick(evt);
}

function showDeleteHint() {
  const h = document.getElementById('deleteHint');
  h.classList.add('show');
  h.textContent = 'Deleted!';
  setTimeout(() => h.classList.remove('show'), 1200);
}

// ===== DRAG: Player placement =====
function startDrag(evt, pid) {
  evt.preventDefault();
  evt.stopPropagation();
  const p = getSVGPoint(evt);
  const f = currentFrameData();
  if (!p || !f.players[pid]) return;

  if (tool === 'player') {
    dragPlayer = pid;
    dragOffset = { x: f.players[pid].x - p.x, y: f.players[pid].y - p.y };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  } else if (tool === 'movement') {
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
  const p = getSVGPoint(evt);
  if (!p) return;
  const f = currentFrameData();
  const nx = p.x + dragOffset.x, ny = p.y + dragOffset.y;
  if (isOnCourt(nx, ny)) {
    f.players[dragPlayer] = { x: nx, y: ny };
    render();
  }
}

function endDrag() {
  dragPlayer = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
  saveState();
}

// ===== DRAG: Movement arrows =====
function onMoveDrag(evt) {
  if (!moveDragPlayer) return;
  evt.preventDefault();
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  const f = currentFrameData();
  f.movements[moveDragPlayer] = { x: p.x, y: p.y };
  render();
}

function endMoveDrag() {
  if (moveDragPlayer) {
    const f = currentFrameData();
    if (moveDragStart && f.movements[moveDragPlayer]) {
      const m = f.movements[moveDragPlayer];
      if (Math.hypot(m.x - moveDragStart.x, m.y - moveDragStart.y) < 5) {
        delete f.movements[moveDragPlayer];
      }
    }
    render();
    saveState();
  }
  moveDragPlayer = null;
  moveDragStart = null;
  document.removeEventListener('mousemove', onMoveDrag);
  document.removeEventListener('mouseup', endMoveDrag);
  document.removeEventListener('touchmove', onMoveDrag);
  document.removeEventListener('touchend', endMoveDrag);
}

// ===== DRAG: Shot lines =====
function initShotDrag() {
  const container = document.getElementById('courtContainer');
  container.addEventListener('mousedown', onShotMouseDown);
  container.addEventListener('touchstart', onShotMouseDown, { passive: false });
}

function onShotMouseDown(evt) {
  if (tool !== 'shot') return;
  if (evt.button === 2) return;
  const p = getSVGPoint(evt);
  if (!p || !isOnCourt(p.x, p.y)) return;
  evt.preventDefault();
  shotStart = { x: p.x, y: p.y };
  shotPreviewLine = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
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
  if (p && isOnCourt(p.x, p.y) && Math.hypot(p.x - shotStart.x, p.y - shotStart.y) > 10) {
    const f = currentFrameData();
    f.shot = { type: shotType, x1: shotStart.x, y1: shotStart.y, x2: p.x, y2: p.y };
  }
  shotStart = null;
  shotPreviewLine = null;
  document.removeEventListener('mousemove', onShotDrag);
  document.removeEventListener('mouseup', endShotDrag);
  document.removeEventListener('touchmove', onShotDrag);
  document.removeEventListener('touchend', endShotDrag);
  render();
  saveState();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
