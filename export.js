// ===== EXPORT =====

function toggleExportMenu() {
  const menu = document.getElementById('exportMenu');
  menu.classList.toggle('show');
}
function hideExportMenu() {
  document.getElementById('exportMenu').classList.remove('show');
}
// Close export menu when clicking elsewhere
document.addEventListener('click', function(e) {
  if (!e.target.closest('.export-dropdown')) hideExportMenu();
});

function exportImage() {
  const w = parseInt(document.getElementById('expW').value) || 1200;
  const h = parseInt(document.getElementById('expH').value) || 630;
  const title = document.getElementById('titleInput').value || 'Badminton Formation';
  const isDark = (document.getElementById('exportBg') || {}).value !== 'light';
  const bgColor = isDark ? '#111318' : '#FAFAFA';
  const textColor = isDark ? '#e8eaed' : '#1A1A1A';
  const mutedColor = isDark ? '#8b919a' : '#666';

  const legendH = 50;
  const titleH = 44;
  // Gather frame notes
  const notes = state.frames.map(f => f.note || '').filter(n => n);
  const notesH = notes.length > 0 ? 30 + notes.length * 16 : 0;
  const courtAreaH = h - titleH - legendH - notesH;

  let innerSvg = state.mode === 'overlay' ? buildOverlaySVGContent() : buildPanelSVGContent();

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  svg += courtGradientDefs();
  svg += `<rect width="${w}" height="${h}" fill="${bgColor}"/>`;
  // Title
  svg += `<text x="${w/2}" y="${titleH/2 + 2}" fill="${textColor}" font-size="18" font-weight="700" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXML(title)}</text>`;

  let cvbW, cvbH;
  const isLand = isLandscapeCourt();
  if (state.mode === 'overlay') { cvbW = isLand ? SH : SW; cvbH = isLand ? SW : SH; }
  else { const n = state.frames.length; const cW = isLand ? SH : SW; cvbW = n * cW + (n - 1) * 20; cvbH = (isLand ? SW : SH) + 30; }
  const scX = (w * 0.96) / cvbW, scY = courtAreaH / cvbH;
  const sc = Math.min(scX, scY) * 0.92;
  const ox = (w - cvbW * sc) / 2;
  const oy = titleH + (courtAreaH - cvbH * sc) / 2;
  svg += `<g transform="translate(${ox},${oy}) scale(${sc})">${innerSvg}</g>`;

  // Legend
  const ly = h - legendH - notesH + 18;
  const shotTypes = ['drop', 'drive', 'smash', 'clear'];
  const legendTotalW = shotTypes.length * 100 + 170;
  let lx = (w - legendTotalW) / 2;
  for (const st of shotTypes) {
    const c = SHOT_COLORS[st];
    svg += `<line x1="${lx}" y1="${ly}" x2="${lx + 24}" y2="${ly}" stroke="${c}" stroke-width="3" ${st === 'drop' ? 'stroke-dasharray="5,3"' : ''}/>`;
    svg += `<text x="${lx + 30}" y="${ly + 1}" fill="${mutedColor}" font-size="12" font-family="system-ui" font-weight="500" dominant-baseline="central">${SHOT_LABELS[st]}</text>`;
    lx += 100;
  }
  svg += `<circle cx="${lx}" cy="${ly}" r="8" fill="${TEAM_COLORS.A}"/>`;
  svg += `<text x="${lx + 14}" y="${ly + 1}" fill="${mutedColor}" font-size="12" font-family="system-ui" font-weight="500" dominant-baseline="central">Team A</text>`;
  lx += 80;
  svg += `<circle cx="${lx}" cy="${ly}" r="8" fill="${TEAM_COLORS.B}"/>`;
  svg += `<text x="${lx + 14}" y="${ly + 1}" fill="${mutedColor}" font-size="12" font-family="system-ui" font-weight="500" dominant-baseline="central">Team B</text>`;

  // Frame notes
  if (notes.length > 0) {
    let ny = h - notesH + 8;
    svg += `<line x1="${w * 0.1}" y1="${ny - 4}" x2="${w * 0.9}" y2="${ny - 4}" stroke="${isDark ? '#2d3139' : '#ddd'}" stroke-width="1"/>`;
    state.frames.forEach((f, i) => {
      if (f.note) {
        svg += `<text x="${w/2}" y="${ny + 10}" fill="${mutedColor}" font-size="11" font-family="system-ui" text-anchor="middle" dominant-baseline="central">Frame ${i + 1}: ${escapeXML(f.note.substring(0, 80))}</text>`;
        ny += 16;
      }
    });
  }
  svg += '</svg>';

  // Render
  const canvas = document.getElementById('exportCanvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = function() {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const a = document.createElement('a');
      a.download = title.replace(/[^a-zA-Z0-9]/g, '_') + '.png';
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      showToast('PNG exported');
    } catch(e) {
      const url = canvas.toDataURL('image/png');
      const win = window.open();
      if (win) { win.document.write('<img src="' + url + '" style="max-width:100%"/>'); win.document.title = 'Right-click to save'; }
      else showToast('Export failed — allow popups');
    }
  };
  img.onerror = () => showToast('Export failed — try smaller resolution');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function buildOverlaySVGContent() {
  const isLand = isLandscapeCourt();
  let svg = '';
  if (isLand) svg += `<g transform="translate(${SH}, 0) rotate(90)">`;
  svg += courtLines();
  for (let i = 0; i < state.frames.length; i++) {
    const f = state.frames[i];
    const op = 0.4 + (i / Math.max(state.frames.length - 1, 1)) * 0.6;
    // Coverage regions
    if (f.regions) svg += regionSVG(f.regions, op);
    for (const pid in f.movements) {
      if (f.players[pid]) svg += movementSVG(pid, f.players[pid].x, f.players[pid].y, f.movements[pid].x, f.movements[pid].y, op);
    }
    if (f.shot) { svg += shotSVG(f.shot, op); svg += frameNumberBadge(i, f.shot.x1, f.shot.y1 - 22); }
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, op, false, i);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 5}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="${op * 0.4}"/>`;
      }
    }
  }
  if (isLand) svg += '</g>';
  return svg;
}

function buildPanelSVGContent() {
  const n = state.frames.length;
  const isLand = isLandscapeCourt();
  const courtW = isLand ? SH : SW;
  const courtH = isLand ? SW : SH;
  const gap = 20;
  let svg = '';
  for (let i = 0; i < n; i++) {
    const ox = i * (courtW + gap);
    const f = state.frames[i];
    svg += `<g transform="translate(${ox}, 30)">`;
    svg += `<text x="${courtW/2}" y="-8" fill="#8b919a" font-size="13" font-weight="700" font-family="system-ui" text-anchor="middle">Frame ${i + 1}</text>`;
    svg += `<rect x="0" y="0" width="${courtW}" height="${courtH}" fill="none" stroke="#383d47" stroke-width="1" rx="4"/>`;
    if (isLand) svg += `<g transform="translate(${SH}, 0) rotate(90)">`;
    svg += courtLines();
    // Coverage regions
    if (f.regions) svg += regionSVG(f.regions, 1);
    for (const pid in f.movements) {
      if (f.players[pid]) svg += movementSVG(pid, f.players[pid].x, f.players[pid].y, f.movements[pid].x, f.movements[pid].y, 1);
    }
    svg += shotSVG(f.shot, 1);
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, 1, false);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 5}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="0.4"/>`;
      }
    }
    if (isLand) svg += '</g>';
    // Frame note (outside rotation so it reads correctly)
    if (f.note) {
      const noteW = Math.min(courtW - 16, 200);
      svg += `<rect x="${(courtW - noteW)/2}" y="${courtH - 26}" width="${noteW}" height="22" rx="4" fill="rgba(0,0,0,.5)"/>`;
      svg += `<text x="${courtW/2}" y="${courtH - 14}" fill="rgba(255,255,255,.6)" font-size="10" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML(f.note.substring(0, 40))}</text>`;
    }
    svg += '</g>';
  }
  return svg;
}

// ===== VIDEO EXPORT =====
function exportVideo() {
  const w = parseInt(document.getElementById('expW').value) || 1200;
  const h = parseInt(document.getElementById('expH').value) || 630;
  const title = document.getElementById('titleInput').value || 'Badminton Formation';
  const isDark = (document.getElementById('exportBg') || {}).value !== 'light';
  const bgColor = isDark ? '#111318' : '#FAFAFA';
  const speed = parseFloat(document.getElementById('animSpeed').value) || 1;

  const canvas = document.getElementById('exportCanvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Check for MediaRecorder support
  if (!('MediaRecorder' in window)) {
    showToast('Video export not supported in this browser');
    return;
  }

  const stream = canvas.captureStream(30);
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      showToast('WebM recording not supported');
      return;
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-zA-Z0-9]/g, '_') + '.webm';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Video exported!');
    document.getElementById('exportBtn').textContent = 'Export ▾';
    document.getElementById('exportBtn').disabled = false;
  };

  showToast('Recording video...');
  document.getElementById('exportBtn').textContent = 'Recording...';
  document.getElementById('exportBtn').disabled = true;
  recorder.start();

  // Build animation frames for each game frame
  const ACTION_DUR = 1.0 / speed;
  const PAUSE_DUR = 0.5 / speed;
  const FPS = 30;
  const frameMs = 1000 / FPS;
  let currentGameFrame = 0;
  let phase = 'action'; // action, pause
  let progress = 0;

  // Init player positions
  const playerPos = {};
  const f0 = state.frames[0];
  for (const pid in f0.players) playerPos[pid] = { ...f0.players[pid] };

  function vLerp(a, b, t) { return a + (b - a) * t; }
  function vEase(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  let videoErrorCount = 0;

  function renderVideoFrame() {
    if (videoErrorCount > 10) { recorder.stop(); showToast('Video export failed — too many render errors'); return; }
    const fr = state.frames[currentGameFrame];
    if (!fr) { recorder.stop(); return; }

    const t = vEase(Math.min(progress, 1));

    // Build SVG for this video frame
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += courtGradientDefs();
    svg += `<rect width="${w}" height="${h}" fill="${bgColor}"/>`;
    // Title
    svg += `<text x="${w/2}" y="26" fill="${isDark ? '#e8eaed' : '#1A1A1A'}" font-size="18" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML(title)}</text>`;

    // Scale court to fit
    const isLand = isLandscapeCourt();
    const vbW = isLand ? SH : SW;
    const vbH = isLand ? SW : SH;
    const courtScale = Math.min((w * 0.9) / vbW, (h - 80) / vbH) * 0.92;
    const ox = (w - vbW * courtScale) / 2;
    const oy = 44 + ((h - 80) - vbH * courtScale) / 2;

    svg += `<g transform="translate(${ox},${oy}) scale(${courtScale})">`;
    if (isLand) svg += `<g transform="translate(${SH}, 0) rotate(90)">`;
    svg += courtLines();

    // Coverage regions
    if (fr.regions) svg += regionSVG(fr.regions, 0.6);

    // Players
    const pids = new Set([...Object.keys(playerPos), ...Object.keys(fr.players)]);
    for (const pid of pids) {
      let pos = playerPos[pid] || fr.players[pid];
      if (!pos) continue;
      let dx = pos.x, dy = pos.y;
      if (phase === 'action' && fr.movements[pid]) {
        const dest = fr.movements[pid];
        dx = vLerp(pos.x, dest.x, t);
        dy = vLerp(pos.y, dest.y, t);
      }
      const team = pid[0];
      const color = TEAM_COLORS[team];
      const label = getPlayerLabel(pid);
      const fs = label.length > 3 ? 10 : (label.length > 2 ? 11 : 13);
      svg += `<circle cx="${dx}" cy="${dy}" r="${PR}" fill="${color}" stroke="rgba(255,255,255,.3)" stroke-width="2"/>`;
      svg += `<text x="${dx}" y="${dy + 1}" fill="#fff" font-size="${fs}" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML(label)}</text>`;
      if (phase === 'action' && fr.movements[pid]) {
        svg += `<line x1="${pos.x}" y1="${pos.y}" x2="${dx}" y2="${dy}" stroke="${color}" stroke-width="2.5" stroke-dasharray="5,4" opacity=".35"/>`;
      }
    }

    // Shot animation
    if (fr.shot && phase === 'action') {
      const shot = fr.shot;
      const c = SHOT_COLORS[shot.type];
      if (shot.type === 'drop' || shot.type === 'clear' || shot.type === 'lift') {
        const ch = shot.type === 'clear' ? -80 : shot.type === 'lift' ? -100 : -40;
        const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 + ch;
        svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="2.5" opacity=".25"/>`;
        const sx = (1-t)*(1-t)*shot.x1 + 2*(1-t)*t*mx + t*t*shot.x2;
        const sy = (1-t)*(1-t)*shot.y1 + 2*(1-t)*t*my + t*t*shot.y2;
        svg += `<circle cx="${sx}" cy="${sy}" r="8" fill="${c}" stroke="#fff" stroke-width="2"/>`;
      } else {
        const ex = vLerp(shot.x1, shot.x2, t), ey = vLerp(shot.y1, shot.y2, t);
        svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="${shot.type === 'smash' ? 6 : 4}" opacity=".85"/>`;
        svg += `<circle cx="${ex}" cy="${ey}" r="8" fill="${c}" stroke="#fff" stroke-width="2"/>`;
      }
      // Shot label
      const lx = (shot.x1 + shot.x2) / 2, ly = (shot.y1 + shot.y2) / 2 - 14;
      const tw = SHOT_LABELS[shot.type].length * 6.5 + 12;
      svg += `<rect x="${lx - tw/2}" y="${ly - 9}" width="${tw}" height="18" rx="4" fill="rgba(0,0,0,.65)"/>`;
      svg += `<text x="${lx}" y="${ly + 1}" fill="${c}" font-size="11" font-family="system-ui" font-weight="700" text-anchor="middle" dominant-baseline="central">${SHOT_LABELS[shot.type]}</text>`;
    } else if (fr.shot) {
      svg += shotSVG(fr.shot, 0.35);
    }

    if (isLand) svg += '</g>';

    // Frame HUD (outside rotation, inside scale group — uses viewBox coordinates)
    svg += `<rect x="8" y="8" width="110" height="26" rx="5" fill="rgba(0,0,0,.65)"/>`;
    svg += `<text x="63" y="22" fill="#fff" font-size="13" font-weight="600" font-family="system-ui" text-anchor="middle" dominant-baseline="central">Frame ${currentGameFrame + 1} / ${state.frames.length}</text>`;

    // Frame note
    if (fr.note) {
      const noteW = Math.min(vbW - 16, 300);
      svg += `<rect x="8" y="${vbH - 30}" width="${noteW}" height="22" rx="4" fill="rgba(0,0,0,.55)"/>`;
      svg += `<text x="${8 + noteW/2}" y="${vbH - 18}" fill="rgba(255,255,255,.7)" font-size="11" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML((fr.note || '').substring(0, 60))}</text>`;
    }

    svg += `</g></svg>`;

    // Render SVG to canvas
    const img = new Image();
    img.onload = function() {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      advanceVideoFrame();
    };
    img.onerror = function() {
      videoErrorCount++;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      advanceVideoFrame();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function advanceVideoFrame() {
    const fr = state.frames[currentGameFrame];
    if (!fr) { recorder.stop(); return; }

    const dt = 1 / FPS;

    if (phase === 'action') {
      const hasContent = fr.shot || Object.keys(fr.movements).length > 0;
      if (!hasContent) {
        phase = 'pause'; progress = 0;
      } else {
        progress += dt / ACTION_DUR;
        if (progress >= 1) {
          // Update positions from movements
          for (const pid in fr.movements) playerPos[pid] = { ...fr.movements[pid] };
          phase = 'pause'; progress = 0;
        }
      }
    } else if (phase === 'pause') {
      progress += dt / PAUSE_DUR;
      if (progress >= 1) {
        currentGameFrame++;
        if (currentGameFrame >= state.frames.length) { recorder.stop(); return; }
        // Inherit positions for next frame
        const nextFr = state.frames[currentGameFrame];
        for (const pid in nextFr.players) playerPos[pid] = { ...nextFr.players[pid] };
        phase = 'action'; progress = 0;
      }
    }

    setTimeout(renderVideoFrame, frameMs);
  }

  // Start the render loop
  renderVideoFrame();
}
