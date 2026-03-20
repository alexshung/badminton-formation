// ===== RENDER =====

function render() {
  const container = document.getElementById('courtContainer');
  if (state.mode === 'overlay') {
    renderOverlay(container, true);
  } else {
    renderPanel(container, true);
  }
  renderTimeline();
  updateStatus();
  saveState();
}

function renderOverlay(container, interactive) {
  let svg = `<svg class="court-svg" viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg"`;
  if (interactive) {
    svg += ` onclick="courtClick(event)" oncontextmenu="courtRightClick(event)"`;
  }
  svg += `><defs><filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter></defs>`;
  svg += courtSVG(0, interactive);

  const totalFrames = state.frames.length;
  for (let i = 0; i < totalFrames; i++) {
    const f = state.frames[i];
    const isActive = (i === state.currentFrame);
    const baseOpacity = isActive ? 1 : 0.3 + (i / totalFrames) * 0.4;

    for (const pid in f.movements) {
      if (f.players[pid]) {
        const from = f.players[pid];
        const to = f.movements[pid];
        svg += movementSVG(pid, from.x, from.y, to.x, to.y, baseOpacity);
      }
    }
    if (f.shot) {
      svg += shotSVG(f.shot, baseOpacity);
      if (f.shot.x1 !== undefined) {
        svg += frameNumberBadge(i, f.shot.x1, f.shot.y1 - 20);
      }
    }
    // Shot preview line (only on active frame while dragging)
    if (isActive && shotPreviewLine && !f.shot) {
      svg += shotSVG({ type: shotType, x1: shotPreviewLine.x1, y1: shotPreviewLine.y1, x2: shotPreviewLine.x2, y2: shotPreviewLine.y2 }, 0.6);
    }
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, baseOpacity, interactive && isActive, i);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 4}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="${baseOpacity * 0.5}"/>`;
      }
    }
    if (!f.shot && Object.keys(f.players).length > 0) {
      const firstP = Object.values(f.players)[0];
      if (firstP) svg += frameNumberBadge(i, PAD + 24, PAD + 24 + i * 24);
    }
  }
  svg += '</svg>';
  container.innerHTML = svg;
}

function renderPanel(container, interactive) {
  const n = state.frames.length;
  const gap = 20;
  const totalW = n * SW + (n - 1) * gap;
  let svg = `<svg class="court-svg" viewBox="0 0 ${totalW} ${SH + 30}" xmlns="http://www.w3.org/2000/svg"`;
  if (interactive) {
    svg += ` onclick="courtClickPanel(event)" oncontextmenu="courtRightClickPanel(event)"`;
  }
  svg += `><defs><filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter></defs>`;

  for (let i = 0; i < n; i++) {
    const offsetX = i * (SW + gap);
    const f = state.frames[i];
    const isActive = (i === state.currentFrame);
    const borderColor = isActive ? '#3B82F6' : '#666';

    svg += `<g transform="translate(${offsetX}, 30)">`;
    svg += `<text x="${SW / 2}" y="-8" fill="${isActive ? '#3B82F6' : '#999'}" font-size="14" font-weight="700" font-family="system-ui" text-anchor="middle">Frame ${i + 1}</text>`;
    svg += `<rect x="0" y="0" width="${SW}" height="${SH}" fill="none" stroke="${borderColor}" stroke-width="${isActive ? 2 : 1}" rx="4"/>`;
    svg += courtSVG(i, interactive && isActive);

    for (const pid in f.movements) {
      if (f.players[pid]) {
        const from = f.players[pid];
        const to = f.movements[pid];
        svg += movementSVG(pid, from.x, from.y, to.x, to.y, 1);
      }
    }
    svg += shotSVG(f.shot, 1);
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, 1, interactive && isActive);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 4}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="0.5"/>`;
      }
    }
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
    const playerCount = Object.keys(f.players).length;
    const hasShot = f.shot ? ' 🏸' : '';
    h += `<button class="frame-btn${active}" onclick="switchFrame(${i})" oncontextmenu="removeFrame(event,${i})">Frame ${i + 1} <span style="font-size:10px;opacity:.6">(${playerCount}P${hasShot})</span></button>`;
  });
  if (state.frames.length < 6) {
    h += `<button class="frame-add" onclick="addFrame()">+</button>`;
  }
  tl.innerHTML = h;
  document.getElementById('frameInfo').textContent = `Frame ${state.currentFrame + 1}/${state.frames.length}`;
}

function updateStatus() {
  const el = document.getElementById('statusText');
  if (tool === 'player') {
    el.textContent = `Place/Move: selected ${selectedPlayer}. Click court to place, drag to reposition.`;
  } else if (tool === 'shot') {
    el.textContent = `Shot (${shotType}): Click and drag on court to draw the shot trajectory`;
  } else if (tool === 'movement') {
    el.textContent = 'Movement: Drag a player to their destination to create a movement arrow';
  }
}

// ===== INIT =====
loadState();
render();
initShotDrag();
document.getElementById('titleInput').addEventListener('input', () => {
  state.title = document.getElementById('titleInput').value;
  saveState();
});

// Handle window resize
window.addEventListener('resize', () => { if (state) render(); });

// Wire up animation speed slider
document.getElementById('animSpeed').addEventListener('change', function () {
  animSpeed = parseFloat(this.value);
});
