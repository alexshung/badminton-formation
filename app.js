// ===== RENDER =====

function render() {
  if (animRunning) return;
  const container = document.getElementById('courtContainer');
  if (state.mode === 'overlay') renderOverlay(container, true);
  else renderPanel(container, true);
  renderTimeline();
  renderFrameNote();
  updateStatus();
  updateCursor();
  updatePlayerPalette();
  saveState();
}

function renderOverlay(container, interactive) {
  const isLand = isLandscapeCourt();
  const vbW = isLand ? SH : SW;
  const vbH = isLand ? SW : SH;

  let svg = `<svg class="court-svg tool-${tool}" viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg"`;
  if (interactive) svg += ` onclick="courtClick(event)" oncontextmenu="courtRightClick(event)"`;
  svg += `>` + courtGradientDefs();
  if (isLand) svg += `<g transform="translate(${SH}, 0) rotate(90)">`;
  svg += courtLines();

  const total = state.frames.length;
  for (let i = 0; i < total; i++) {
    const f = state.frames[i];
    const isActive = i === state.currentFrame;
    const baseOp = isActive ? 1 : 0.3 + (i / total) * 0.4;

    // Coverage regions (rendered behind players and shots)
    if (f.regions) svg += regionSVG(f.regions, baseOp);

    for (const pid in f.movements) {
      if (f.players[pid]) svg += movementSVG(pid, f.players[pid].x, f.players[pid].y, f.movements[pid].x, f.movements[pid].y, baseOp);
    }
    if (f.shot) {
      svg += shotSVG(f.shot, baseOp);
      svg += frameNumberBadge(i, f.shot.x1, f.shot.y1 - 22);
    }
    if (isActive && shotPreviewLine && !f.shot) {
      svg += shotSVG({ type: shotType, x1: shotPreviewLine.x1, y1: shotPreviewLine.y1, x2: shotPreviewLine.x2, y2: shotPreviewLine.y2 }, 0.45);
    }
    // Coverage drawing preview
    if (isActive && tool === 'coverage' && coveragePoints.length > 0) {
      svg += coveragePreviewSVG(coveragePoints, coveragePreview, selectedPlayer);
    }
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, baseOp, interactive && isActive, i);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 5}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="${baseOp * 0.4}"/>`;
        const lbl = getPlayerLabel(pid);
        svg += `<text x="${d.x}" y="${d.y}" fill="${TEAM_COLORS[pid[0]]}" font-size="9" font-weight="600" font-family="system-ui" text-anchor="middle" dominant-baseline="central" opacity="${baseOp * 0.4}">${escapeXML(lbl)}</text>`;
      }
    }
    if (!f.shot && Object.keys(f.players).length > 0) {
      svg += frameNumberBadge(i, PAD + 22, PAD + 22 + i * 28);
    }
    // Shuttle position for current frame — one icon only
    if (isActive) {
      if (f.shot) {
        svg += shuttlecockSVG(f.shot.x2, f.shot.y2, 0.8);
      } else {
        const shuttle = getShuttlePosition(i);
        if (shuttle) svg += shuttlecockSVG(shuttle.x, shuttle.y, 1);
      }
    }
  }
  if (isLand) svg += '</g>';
  svg += '</svg>';
  container.innerHTML = svg;
}

function renderPanel(container, interactive) {
  const n = state.frames.length;
  const isLand = isLandscapeCourt();
  const courtW = isLand ? SH : SW;
  const courtH = isLand ? SW : SH;
  const gap = 20;
  const totalW = n * courtW + (n - 1) * gap;
  let svg = `<svg class="court-svg tool-${tool}" viewBox="0 0 ${totalW} ${courtH + 30}" xmlns="http://www.w3.org/2000/svg"`;
  if (interactive) svg += ` onclick="courtClickPanel(event)" oncontextmenu="courtRightClickPanel(event)"`;
  svg += `>` + courtGradientDefs();

  for (let i = 0; i < n; i++) {
    const ox = i * (courtW + gap);
    const f = state.frames[i];
    const isActive = i === state.currentFrame;
    svg += `<g transform="translate(${ox}, 30)">`;
    svg += `<text x="${courtW/2}" y="-8" fill="${isActive ? '#4a9eff' : '#8b919a'}" font-size="13" font-weight="700" font-family="system-ui" text-anchor="middle">Frame ${i + 1}</text>`;
    svg += `<rect x="0" y="0" width="${courtW}" height="${courtH}" fill="none" stroke="${isActive ? '#4a9eff' : '#383d47'}" stroke-width="${isActive ? 2 : 1}" rx="4"/>`;
    if (isLand) svg += `<g transform="translate(${SH}, 0) rotate(90)">`;
    svg += courtLines();
    // Coverage regions
    if (f.regions) svg += regionSVG(f.regions, 1);
    for (const pid in f.movements) {
      if (f.players[pid]) svg += movementSVG(pid, f.players[pid].x, f.players[pid].y, f.movements[pid].x, f.movements[pid].y, 1);
    }
    svg += shotSVG(f.shot, 1);
    // Shot preview line (active frame only)
    if (isActive && shotPreviewLine && !f.shot) {
      svg += shotSVG({ type: shotType, x1: shotPreviewLine.x1, y1: shotPreviewLine.y1, x2: shotPreviewLine.x2, y2: shotPreviewLine.y2 }, 0.45);
    }
    // Coverage drawing preview
    if (isActive && tool === 'coverage' && coveragePoints.length > 0) {
      svg += coveragePreviewSVG(coveragePoints, coveragePreview, selectedPlayer);
    }
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, 1, interactive && isActive);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 5}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="0.4"/>`;
        const lbl = getPlayerLabel(pid);
        svg += `<text x="${d.x}" y="${d.y}" fill="${TEAM_COLORS[pid[0]]}" font-size="9" font-weight="600" font-family="system-ui" text-anchor="middle" dominant-baseline="central" opacity="0.4">${escapeXML(lbl)}</text>`;
      }
    }
    // Shuttle position — one per frame
    if (f.shot) {
      svg += shuttlecockSVG(f.shot.x2, f.shot.y2, 0.7);
    } else {
      const shuttle = getShuttlePosition(i);
      if (shuttle) svg += shuttlecockSVG(shuttle.x, shuttle.y, 0.8);
    }
    if (isLand) svg += '</g>';
    svg += '</g>';
  }
  svg += '</svg>';
  container.innerHTML = svg;
}

function renderTimeline() {
  const tl = document.getElementById('timeline');
  let h = '';
  state.frames.forEach((f, i) => {
    const active = i === state.currentFrame ? ' active' : '';
    const pc = Object.keys(f.players).length;
    const hasShot = f.shot;
    const hasMoves = Object.keys(f.movements).length > 0;
    let dots = '';
    if (pc > 0) dots += `<span class="frame-dot" style="background:var(--accent)"></span>`;
    if (hasShot) dots += `<span class="frame-dot" style="background:${SHOT_COLORS[f.shot.type]}"></span>`;
    if (hasMoves) dots += `<span class="frame-dot" style="background:var(--muted)"></span>`;
    h += `<button class="frame-btn${active}" onclick="switchFrame(${i})" oncontextmenu="removeFrame(event,${i})">${dots}F${i + 1}<span class="frame-meta">${pc}P</span></button>`;
  });
  if (state.frames.length < 6) {
    h += `<button class="timeline-action" onclick="duplicateFrame()" title="Duplicate current frame">⧉</button>`;
    h += `<button class="timeline-action" onclick="addFrame()" title="Add new frame">+</button>`;
  }
  tl.innerHTML = h;
  document.getElementById('frameInfo').textContent = `Frame ${state.currentFrame + 1}/${state.frames.length}`;
}

function renderFrameNote() {
  const el = document.getElementById('frameNote');
  if (el) el.value = currentFrameData().note || '';
}

function updatePlayerPalette() {
  document.querySelectorAll('.player-token').forEach(tok => {
    const pid = tok.dataset.player;
    const nameEl = tok.querySelector('.player-name');
    if (nameEl) nameEl.textContent = getPlayerLabel(pid);
    tok.classList.toggle('active', pid === selectedPlayer);
  });
}

function updateStatus() {
  const el = document.getElementById('statusText');
  if (tool === 'player') el.textContent = `Place/Move: ${getPlayerLabel(selectedPlayer)} — click to place, drag to reposition`;
  else if (tool === 'shot') el.textContent = `Shot (${SHOT_LABELS[shotType]}): click near a player and drag to the landing spot`;
  else if (tool === 'movement') el.textContent = `Movement: drag ${getPlayerLabel(selectedPlayer)} to set movement path`;
  else if (tool === 'coverage') {
    if (coveragePoints.length === 0) el.textContent = `Coverage: click to start drawing ${getPlayerLabel(selectedPlayer)}'s zone`;
    else if (coveragePoints.length < 3) el.textContent = `Coverage: click to add points (${coveragePoints.length} placed, need at least 3)`;
    else el.textContent = `Coverage: click to add points, or click near first point / double-click to close (${coveragePoints.length} points)`;
  }
}

// ===== INIT =====
loadState();
render();
initShotDrag();
initCoverageTracking();

document.getElementById('titleInput').addEventListener('input', () => {
  state.title = document.getElementById('titleInput').value;
  saveState();
});

// Frame note input
document.getElementById('frameNote').addEventListener('input', function() {
  currentFrameData().note = this.value;
  saveState();
});

window.addEventListener('resize', () => {
  if (state && !animRunning) render();
  updateOrientBtn();
});

function updateOrientBtn() {
  const btn = document.getElementById('courtOrientBtn');
  if (btn) btn.title = isLandscapeCourt() ? 'Switch to portrait court' : 'Switch to landscape court';
}

document.getElementById('courtContainer').addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('courtContainer').addEventListener('touchmove', function(e) {
  if (dragPlayer || moveDragPlayer || shotStart) e.preventDefault();
}, { passive: false });

// Export bg toggle
const expBgEl = document.getElementById('exportBg');
if (expBgEl) expBgEl.addEventListener('change', function() { state.exportBg = this.value; saveState(); });

updateOrientBtn();
