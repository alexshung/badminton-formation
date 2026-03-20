// ===== EXPORT =====

function exportImage() {
  const w = parseInt(document.getElementById('expW').value) || 1200;
  const h = parseInt(document.getElementById('expH').value) || 630;
  const title = document.getElementById('titleInput').value || 'Badminton Formation';

  let exportSvg = '';
  const legendH = 50;
  const titleH = 40;
  const courtAreaH = h - titleH - legendH;
  const courtAreaW = w;

  let innerSvg = '';
  if (state.mode === 'overlay') {
    innerSvg = buildOverlaySVGContent();
  } else {
    innerSvg = buildPanelSVGContent();
  }

  exportSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  exportSvg += `<rect width="${w}" height="${h}" fill="#FAFAFA"/>`;
  exportSvg += `<text x="${w / 2}" y="${titleH / 2 + 4}" fill="#1A1A1A" font-size="18" font-weight="700" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXML(title)}</text>`;

  let cvbW, cvbH;
  if (state.mode === 'overlay') {
    cvbW = SW; cvbH = SH;
  } else {
    const n = state.frames.length;
    cvbW = n * SW + (n - 1) * 20;
    cvbH = SH + 30;
  }
  const scaleX = courtAreaW / cvbW;
  const scaleY = courtAreaH / cvbH;
  const sc = Math.min(scaleX, scaleY) * 0.92;
  const ox = (courtAreaW - cvbW * sc) / 2;
  const oy = titleH + (courtAreaH - cvbH * sc) / 2;
  exportSvg += `<g transform="translate(${ox},${oy}) scale(${sc})">`;
  exportSvg += `<defs><filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter></defs>`;
  exportSvg += innerSvg;
  exportSvg += '</g>';

  const ly = h - legendH + 15;
  const shotTypes = ['drop', 'drive', 'smash', 'clear'];
  const legendW = shotTypes.length * 120;
  let lx = (w - legendW) / 2;
  for (const st of shotTypes) {
    const c = SHOT_COLORS[st];
    exportSvg += `<line x1="${lx}" y1="${ly}" x2="${lx + 30}" y2="${ly}" stroke="${c}" stroke-width="3" ${st === 'drop' ? 'stroke-dasharray="6,3"' : ''}/>`;
    exportSvg += `<text x="${lx + 36}" y="${ly + 1}" fill="#666" font-size="12" font-family="system-ui" dominant-baseline="central">${SHOT_LABELS[st]}</text>`;
    lx += 120;
  }
  exportSvg += `<circle cx="${lx}" cy="${ly}" r="8" fill="${TEAM_COLORS.A}"/>`;
  exportSvg += `<text x="${lx + 14}" y="${ly + 1}" fill="#666" font-size="12" font-family="system-ui" dominant-baseline="central">Team A</text>`;
  lx += 80;
  exportSvg += `<circle cx="${lx}" cy="${ly}" r="8" fill="${TEAM_COLORS.B}"/>`;
  exportSvg += `<text x="${lx + 14}" y="${ly + 1}" fill="#666" font-size="12" font-family="system-ui" dominant-baseline="central">Team B</text>`;
  exportSvg += '</svg>';

  // Render to canvas using data URI
  const canvas = document.getElementById('exportCanvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const svgData = encodeURIComponent(exportSvg);
  const dataUri = 'data:image/svg+xml;charset=utf-8,' + svgData;
  img.onload = function () {
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const a = document.createElement('a');
      a.download = title.replace(/[^a-zA-Z0-9]/g, '_') + '.png';
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      const dataUrl = canvas.toDataURL('image/png');
      const win = window.open();
      if (win) {
        win.document.write('<img src="' + dataUrl + '" style="max-width:100%"/>');
        win.document.title = title + ' - Right-click to save';
      } else {
        alert('Export failed: please allow popups or try right-clicking the court to save.');
      }
    }
  };
  img.onerror = function () {
    alert('Export failed to render. Try a smaller resolution.');
  };
  img.src = dataUri;
}

function buildOverlaySVGContent() {
  let svg = courtSVG(0, false);
  for (let i = 0; i < state.frames.length; i++) {
    const f = state.frames[i];
    const op = 0.4 + (i / state.frames.length) * 0.6;
    for (const pid in f.movements) {
      if (f.players[pid]) {
        svg += movementSVG(pid, f.players[pid].x, f.players[pid].y, f.movements[pid].x, f.movements[pid].y, op);
      }
    }
    if (f.shot) {
      svg += shotSVG(f.shot, op);
      svg += frameNumberBadge(i, f.shot.x1, f.shot.y1 - 20);
    }
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, op, false, i);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 4}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="${op * 0.5}"/>`;
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
    svg += `<text x="${SW / 2}" y="-8" fill="#666" font-size="14" font-weight="700" font-family="system-ui" text-anchor="middle">Frame ${i + 1}</text>`;
    svg += `<rect x="0" y="0" width="${SW}" height="${SH}" fill="none" stroke="#999" stroke-width="1" rx="4"/>`;
    svg += courtSVG(i, false);
    for (const pid in f.movements) {
      if (f.players[pid]) {
        svg += movementSVG(pid, f.players[pid].x, f.players[pid].y, f.movements[pid].x, f.movements[pid].y, 1);
      }
    }
    svg += shotSVG(f.shot, 1);
    for (const pid in f.players) {
      const p = f.players[pid];
      svg += playerSVG(pid, p.x, p.y, 1, false);
      if (f.movements[pid]) {
        const d = f.movements[pid];
        svg += `<circle cx="${d.x}" cy="${d.y}" r="${PR - 4}" fill="none" stroke="${TEAM_COLORS[pid[0]]}" stroke-width="2" stroke-dasharray="4,3" opacity="0.5"/>`;
      }
    }
    svg += '</g>';
  }
  return svg;
}
