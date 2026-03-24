// ===== EXPORT =====

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
  if (state.mode === 'overlay') { cvbW = SW; cvbH = SH; }
  else { const n = state.frames.length; cvbW = n * SW + (n - 1) * 20; cvbH = SH + 30; }
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
  let svg = courtLines();
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
  return svg;
}

function buildPanelSVGContent() {
  const n = state.frames.length;
  const gap = 20;
  let svg = '';
  for (let i = 0; i < n; i++) {
    const ox = i * (SW + gap);
    const f = state.frames[i];
    svg += `<g transform="translate(${ox}, 30)">`;
    svg += `<text x="${SW/2}" y="-8" fill="#8b919a" font-size="13" font-weight="700" font-family="system-ui" text-anchor="middle">Frame ${i + 1}</text>`;
    svg += `<rect x="0" y="0" width="${SW}" height="${SH}" fill="none" stroke="#383d47" stroke-width="1" rx="4"/>`;
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
    // Frame note in panel
    if (f.note) {
      svg += `<rect x="${PAD + 4}" y="${PAD + CH - 26}" width="${CW - 8}" height="22" rx="4" fill="rgba(0,0,0,.5)"/>`;
      svg += `<text x="${PAD + CW/2}" y="${PAD + CH - 14}" fill="rgba(255,255,255,.6)" font-size="10" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${escapeXML(f.note.substring(0, 40))}</text>`;
    }
    svg += '</g>';
  }
  return svg;
}
