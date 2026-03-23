// ===== ANIMATION ENGINE =====
let animRunning = false;
let animFrameId = null;
let animState = null;
let lastAnimTime = 0;

function toggleAnimation() {
  if (animRunning) stopAnimation();
  else startAnimation();
}

function startAnimation() {
  const hasContent = state.frames.some(f => Object.keys(f.players).length > 0);
  if (!hasContent) { showToast('Add players first'); return; }
  animRunning = true;
  document.getElementById('playBtn').classList.add('active');
  document.getElementById('playBtn').innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor"/></svg>';
  document.querySelectorAll('.tool-btn,.shot-btn,.player-token,.frame-btn,.timeline-action').forEach(b => b.style.pointerEvents = 'none');

  const initPositions = {};
  const f0 = state.frames[0];
  for (const pid in f0.players) initPositions[pid] = { ...f0.players[pid] };

  animState = { frameIdx: 0, phase: 'shot', progress: 0, playerPositions: initPositions };
  lastAnimTime = 0;
  animTick(performance.now());
}

function stopAnimation() {
  animRunning = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null; animState = null;
  const btn = document.getElementById('playBtn');
  btn.classList.remove('active');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="2,1 13,7 2,13" fill="currentColor"/></svg>';
  document.querySelectorAll('.tool-btn,.shot-btn,.player-token,.frame-btn,.timeline-action').forEach(b => b.style.pointerEvents = '');
  render();
}

function animTick(timestamp) {
  if (!animRunning || !animState) return;
  if (!lastAnimTime) lastAnimTime = timestamp;
  const rawDt = (timestamp - lastAnimTime) / 1000;
  const speed = parseFloat(document.getElementById('animSpeed').value) || 1;
  const dt = rawDt * speed;
  lastAnimTime = timestamp;

  const fr = state.frames[animState.frameIdx];
  if (!fr) { stopAnimation(); return; }

  const SHOT_DUR = 0.8, MOVE_DUR = 0.6, PAUSE_DUR = 0.4;

  if (animState.phase === 'shot') {
    if (!fr.shot) { animState.phase = 'move'; animState.progress = 0; }
    else {
      animState.progress += dt / SHOT_DUR;
      if (animState.progress >= 1) { animState.progress = 1; animState.phase = 'move'; animState.progress = 0; }
    }
  } else if (animState.phase === 'move') {
    if (!Object.keys(fr.movements).length) { animState.phase = 'pause'; animState.progress = 0; }
    else {
      animState.progress += dt / MOVE_DUR;
      if (animState.progress >= 1) {
        animState.progress = 1;
        for (const pid in fr.movements) animState.playerPositions[pid] = { ...fr.movements[pid] };
        animState.phase = 'pause'; animState.progress = 0;
      }
    }
  } else if (animState.phase === 'pause') {
    animState.progress += dt / PAUSE_DUR;
    if (animState.progress >= 1) {
      animState.frameIdx++;
      if (animState.frameIdx >= state.frames.length) { stopAnimation(); return; }
      const nextFr = state.frames[animState.frameIdx];
      const np = {};
      for (const pid in animState.playerPositions) np[pid] = { ...animState.playerPositions[pid] };
      for (const pid in nextFr.players) np[pid] = { ...nextFr.players[pid] };
      animState.playerPositions = np;
      animState.phase = 'shot'; animState.progress = 0;
    }
  }

  renderAnimFrame();
  animFrameId = requestAnimationFrame(animTick);
}

function renderAnimFrame() {
  if (!animState) return;
  const fr = state.frames[animState.frameIdx];
  if (!fr) return;
  const t = easeInOut(Math.min(animState.progress, 1));
  let svg = courtGradientDefs() + courtLines();

  // Players
  const pids = new Set([...Object.keys(animState.playerPositions), ...Object.keys(fr.players)]);
  for (const pid of pids) {
    let pos = animState.playerPositions[pid] || fr.players[pid];
    if (!pos) continue;
    let dx = pos.x, dy = pos.y;
    if (animState.phase === 'move' && fr.movements[pid]) {
      const dest = fr.movements[pid];
      dx = lerp(pos.x, dest.x, t); dy = lerp(pos.y, dest.y, t);
    }
    const team = pid[0];
    const color = TEAM_COLORS[team];
    const label = getPlayerLabel(pid);
    const fs = label.length > 3 ? 10 : (label.length > 2 ? 11 : 13);
    svg += `<circle cx="${dx}" cy="${dy}" r="${PR}" fill="${color}" stroke="rgba(255,255,255,.3)" stroke-width="2" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))"/>`;
    svg += `<circle cx="${dx}" cy="${dy - 3}" r="${PR - 6}" fill="rgba(255,255,255,.15)"/>`;
    svg += `<text x="${dx}" y="${dy + 1}" fill="#fff" font-size="${fs}" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML(label)}</text>`;
    if (animState.phase === 'move' && fr.movements[pid]) {
      svg += `<line x1="${pos.x}" y1="${pos.y}" x2="${dx}" y2="${dy}" stroke="${color}" stroke-width="2.5" stroke-dasharray="5,4" opacity=".35"/>`;
    }
  }

  // Shot animation
  if (fr.shot && animState.phase === 'shot') {
    const shot = fr.shot;
    const c = SHOT_COLORS[shot.type];
    const dp = t;
    if (shot.type === 'drop' || shot.type === 'clear') {
      const ch = shot.type === 'clear' ? -80 : -40;
      const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 + ch;
      svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="2.5" opacity=".2" ${shot.type === 'drop' ? 'stroke-dasharray="8,5"' : ''}/>`;
      const sx = (1 - dp) * (1 - dp) * shot.x1 + 2 * (1 - dp) * dp * mx + dp * dp * shot.x2;
      const sy = (1 - dp) * (1 - dp) * shot.y1 + 2 * (1 - dp) * dp * my + dp * dp * shot.y2;
      svg += `<circle cx="${sx}" cy="${sy}" r="9" fill="${c}" stroke="#fff" stroke-width="2" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))"/>`;
    } else {
      const ex = lerp(shot.x1, shot.x2, dp), ey = lerp(shot.y1, shot.y2, dp);
      svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="2.5" opacity=".2"/>`;
      svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="${shot.type === 'smash' ? 6 : 4.5}" opacity=".85"/>`;
      svg += `<circle cx="${ex}" cy="${ey}" r="9" fill="${c}" stroke="#fff" stroke-width="2" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))"/>`;
      if (shot.type === 'smash' && dp > 0.85) {
        const is = (dp - 0.85) / 0.15;
        svg += `<circle cx="${ex}" cy="${ey}" r="${12 + is * 28}" fill="none" stroke="${c}" stroke-width="2.5" opacity="${1 - is}"/>`;
      }
    }
  } else if (fr.shot) {
    svg += shotSVG(fr.shot, 0.35);
  }

  // Frame HUD
  svg += `<rect x="${PAD + 8}" y="${PAD + 8}" width="110" height="26" rx="5" fill="rgba(0,0,0,.65)"/>`;
  svg += `<text x="${PAD + 63}" y="${PAD + 22}" fill="#fff" font-size="13" font-weight="600" font-family="system-ui" text-anchor="middle" dominant-baseline="central">Frame ${animState.frameIdx + 1} / ${state.frames.length}</text>`;
  if (fr.shot && animState.phase === 'shot') {
    svg += `<rect x="${PAD + CW - 72}" y="${PAD + 8}" width="64" height="22" rx="5" fill="rgba(0,0,0,.55)"/>`;
    svg += `<text x="${PAD + CW - 40}" y="${PAD + 20}" fill="${SHOT_COLORS[fr.shot.type]}" font-size="12" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${SHOT_LABELS[fr.shot.type]}</text>`;
  }

  // Frame note
  if (fr.note) {
    const noteY = PAD + CH - 8;
    svg += `<rect x="${PAD + 8}" y="${noteY - 18}" width="${CW - 16}" height="22" rx="4" fill="rgba(0,0,0,.55)"/>`;
    svg += `<text x="${PAD + CW/2}" y="${noteY - 6}" fill="rgba(255,255,255,.7)" font-size="11" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML(fr.note.substring(0, 60))}</text>`;
  }

  document.getElementById('courtContainer').innerHTML = `<svg class="court-svg" viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
