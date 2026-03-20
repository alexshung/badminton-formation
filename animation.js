// ===== ANIMATION ENGINE =====
let animRunning = false;
let animSpeed = 1;
let animFrameId = null;
let animState = null; // { frameIdx, phase, progress, playerPositions }
// phase: 'shot' = animate shuttle, 'move' = animate player movement, 'pause' = brief pause between frames

function toggleAnimation() {
  if (animRunning) { stopAnimation(); }
  else { startAnimation(); }
}

function startAnimation() {
  const hasContent = state.frames.some(f => Object.keys(f.players).length > 0);
  if (!hasContent) return;
  animRunning = true;
  document.getElementById('playBtn').textContent = '⏹';
  document.getElementById('playBtn').title = 'Stop';
  document.querySelectorAll('.tool-btn,.shot-btn,.player-token,.frame-btn').forEach(b => b.style.pointerEvents = 'none');

  const initPositions = {};
  const f0 = state.frames[0];
  for (const pid in f0.players) {
    initPositions[pid] = { ...f0.players[pid] };
  }

  animState = {
    frameIdx: 0,
    phase: 'shot',
    progress: 0,
    playerPositions: initPositions,
    shuttlePos: null
  };
  animTick(performance.now());
}

function stopAnimation() {
  animRunning = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
  animState = null;
  document.getElementById('playBtn').textContent = '▶';
  document.getElementById('playBtn').title = 'Play';
  document.querySelectorAll('.tool-btn,.shot-btn,.player-token,.frame-btn').forEach(b => b.style.pointerEvents = '');
  render();
}

let lastAnimTime = 0;
function animTick(timestamp) {
  if (!animRunning || !animState) return;
  if (!lastAnimTime) lastAnimTime = timestamp;
  const dt = (timestamp - lastAnimTime) / 1000 * animSpeed;
  lastAnimTime = timestamp;

  const fr = state.frames[animState.frameIdx];
  if (!fr) { stopAnimation(); return; }

  const SHOT_DURATION = 0.8;
  const MOVE_DURATION = 0.6;
  const PAUSE_DURATION = 0.3;

  if (animState.phase === 'shot') {
    animState.progress += dt / SHOT_DURATION;
    if (animState.progress >= 1) {
      animState.progress = 1;
      animState.phase = 'move';
      animState.progress = 0;
    }
  } else if (animState.phase === 'move') {
    animState.progress += dt / MOVE_DURATION;
    if (animState.progress >= 1) {
      animState.progress = 1;
      for (const pid in fr.movements) {
        animState.playerPositions[pid] = { ...fr.movements[pid] };
      }
      animState.phase = 'pause';
      animState.progress = 0;
    }
  } else if (animState.phase === 'pause') {
    animState.progress += dt / PAUSE_DURATION;
    if (animState.progress >= 1) {
      animState.frameIdx++;
      if (animState.frameIdx >= state.frames.length) {
        stopAnimation();
        return;
      }
      const nextFr = state.frames[animState.frameIdx];
      const newPositions = {};
      for (const pid in animState.playerPositions) {
        newPositions[pid] = { ...animState.playerPositions[pid] };
      }
      for (const pid in nextFr.players) {
        newPositions[pid] = { ...nextFr.players[pid] };
      }
      animState.playerPositions = newPositions;
      animState.phase = 'shot';
      animState.progress = 0;
    }
  }

  renderAnimFrame();
  animFrameId = requestAnimationFrame(animTick);
}

function renderAnimFrame() {
  if (!animState) return;
  const fr = state.frames[animState.frameIdx];
  if (!fr) return;

  let svg = courtBaseSVG();
  const t = easeInOut(Math.min(animState.progress, 1));

  const allPlayerIds = new Set([...Object.keys(animState.playerPositions), ...Object.keys(fr.players)]);
  for (const pid of allPlayerIds) {
    let pos = animState.playerPositions[pid] || fr.players[pid];
    if (!pos) continue;
    let drawX = pos.x, drawY = pos.y;

    if (animState.phase === 'move' && fr.movements[pid]) {
      const dest = fr.movements[pid];
      drawX = lerp(pos.x, dest.x, t);
      drawY = lerp(pos.y, dest.y, t);
    }

    const team = pid.startsWith('A') ? 'A' : 'B';
    const color = TEAM_COLORS[team];
    svg += `<circle cx="${drawX}" cy="${drawY}" r="${PR}" fill="${color}" stroke="#fff" stroke-width="3" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>`;
    svg += `<text x="${drawX}" y="${drawY}" fill="#fff" font-size="18" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${pid}</text>`;

    if (animState.phase === 'move' && fr.movements[pid]) {
      svg += `<line x1="${pos.x}" y1="${pos.y}" x2="${drawX}" y2="${drawY}" stroke="${color}" stroke-width="2.5" stroke-dasharray="6,4" opacity="0.5"/>`;
    }
  }

  if (fr.shot && (animState.phase === 'shot' || animState.phase === 'move' || animState.phase === 'pause')) {
    const shot = fr.shot;
    const c = SHOT_COLORS[shot.type] || '#fff';

    if (animState.phase === 'shot') {
      const drawProgress = t;

      if (shot.type === 'drop' || shot.type === 'clear') {
        const curveHeight = shot.type === 'clear' ? -80 : -40;
        const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 + curveHeight;
        svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="3" opacity="0.2" ${shot.type === 'drop' ? 'stroke-dasharray="10,6"' : ''}/>`;
        const sx = (1 - drawProgress) * (1 - drawProgress) * shot.x1 + 2 * (1 - drawProgress) * drawProgress * mx + drawProgress * drawProgress * shot.x2;
        const sy = (1 - drawProgress) * (1 - drawProgress) * shot.y1 + 2 * (1 - drawProgress) * drawProgress * my + drawProgress * drawProgress * shot.y2;
        svg += `<circle cx="${sx}" cy="${sy}" r="8" fill="${c}" stroke="#fff" stroke-width="2" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))"/>`;
        svg += `<text x="${sx}" y="${sy}" fill="#fff" font-size="10" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">🏸</text>`;
      } else {
        const ex = lerp(shot.x1, shot.x2, drawProgress);
        const ey = lerp(shot.y1, shot.y2, drawProgress);
        svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="3" opacity="0.2"/>`;
        svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="${shot.type === 'smash' ? 6 : 4}" opacity="0.9"/>`;
        svg += `<circle cx="${ex}" cy="${ey}" r="8" fill="${c}" stroke="#fff" stroke-width="2" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))"/>`;
        if (shot.type === 'smash' && drawProgress > 0.9) {
          svg += `<circle cx="${ex}" cy="${ey}" r="${12 + (drawProgress - 0.9) * 80}" fill="none" stroke="${c}" stroke-width="3" opacity="${1 - drawProgress}"/>`;
        }
      }
    } else {
      svg += shotSVG(shot, 0.6);
    }
  }

  svg += `<text x="${PAD + 10}" y="${PAD + 25}" fill="#fff" font-size="20" font-weight="700" font-family="system-ui" filter="url(#shadow)">Frame ${animState.frameIdx + 1}/${state.frames.length}</text>`;

  if (fr.shot && animState.phase === 'shot') {
    svg += `<text x="${PAD + CW - 10}" y="${PAD + 25}" fill="${SHOT_COLORS[fr.shot.type]}" font-size="18" font-weight="700" font-family="system-ui" text-anchor="end">${SHOT_LABELS[fr.shot.type]}</text>`;
  }

  const container = document.getElementById('courtContainer');
  container.innerHTML = `<svg class="court-svg" viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
