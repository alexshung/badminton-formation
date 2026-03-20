// ===== COURT SVG GENERATION =====

function courtBaseSVG() {
  let svg = '';
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" rx="4" fill="#2D5F2D"/>`;
  const lw = 2, lc = '#FFFFFF';
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" fill="none" stroke="${lc}" stroke-width="${lw}"/>`;
  const ss = 46;
  svg += `<line x1="${PAD + ss}" y1="${PAD}" x2="${PAD + ss}" y2="${PAD + CH}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<line x1="${PAD + CW - ss}" y1="${PAD}" x2="${PAD + CW - ss}" y2="${PAD + CH}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  const netY = PAD + CH / 2;
  svg += `<line x1="${PAD}" y1="${netY}" x2="${PAD + CW}" y2="${netY}" stroke="#CCCCCC" stroke-width="3" stroke-dasharray="8,4"/>`;
  const ssl = 198;
  svg += `<line x1="${PAD}" y1="${netY - ssl}" x2="${PAD + CW}" y2="${netY - ssl}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<line x1="${PAD}" y1="${netY + ssl}" x2="${PAD + CW}" y2="${netY + ssl}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  const lsl = 76;
  svg += `<line x1="${PAD}" y1="${PAD + lsl}" x2="${PAD + CW}" y2="${PAD + lsl}" stroke="${lc}" stroke-width="${lw * 0.5}"/>`;
  svg += `<line x1="${PAD}" y1="${PAD + CH - lsl}" x2="${PAD + CW}" y2="${PAD + CH - lsl}" stroke="${lc}" stroke-width="${lw * 0.5}"/>`;
  const cx = PAD + CW / 2;
  svg += `<line x1="${cx}" y1="${netY - ssl}" x2="${cx}" y2="${PAD}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<line x1="${cx}" y1="${netY + ssl}" x2="${cx}" y2="${PAD + CH}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<text x="${PAD + CW + 16}" y="${netY}" fill="#999" font-size="15" font-family="system-ui" font-weight="600" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,${PAD + CW + 16},${netY})">NET</text>`;
  svg += `<defs><filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.5"/></filter></defs>`;
  return svg;
}

function courtSVG(frameIdx, interactive, scale) {
  const s = scale || 1;
  const f = state.frames[frameIdx];
  let svg = '';
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" rx="4" fill="#2D5F2D"/>`;
  const lw = 2;
  const lc = '#FFFFFF';
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" fill="none" stroke="${lc}" stroke-width="${lw}"/>`;
  const ss = 46;
  svg += `<line x1="${PAD + ss}" y1="${PAD}" x2="${PAD + ss}" y2="${PAD + CH}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<line x1="${PAD + CW - ss}" y1="${PAD}" x2="${PAD + CW - ss}" y2="${PAD + CH}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  const netY = PAD + CH / 2;
  svg += `<line x1="${PAD}" y1="${netY}" x2="${PAD + CW}" y2="${netY}" stroke="#CCCCCC" stroke-width="3" stroke-dasharray="8,4"/>`;
  const ssl = 198;
  svg += `<line x1="${PAD}" y1="${netY - ssl}" x2="${PAD + CW}" y2="${netY - ssl}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<line x1="${PAD}" y1="${netY + ssl}" x2="${PAD + CW}" y2="${netY + ssl}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  const lsl = 76;
  svg += `<line x1="${PAD}" y1="${PAD + lsl}" x2="${PAD + CW}" y2="${PAD + lsl}" stroke="${lc}" stroke-width="${lw * 0.5}"/>`;
  svg += `<line x1="${PAD}" y1="${PAD + CH - lsl}" x2="${PAD + CW}" y2="${PAD + CH - lsl}" stroke="${lc}" stroke-width="${lw * 0.5}"/>`;
  const cx = PAD + CW / 2;
  svg += `<line x1="${cx}" y1="${netY - ssl}" x2="${cx}" y2="${PAD}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<line x1="${cx}" y1="${netY + ssl}" x2="${cx}" y2="${PAD + CH}" stroke="${lc}" stroke-width="${lw * 0.7}"/>`;
  svg += `<text x="${PAD + CW + 16}" y="${netY}" fill="#999" font-size="15" font-family="system-ui" font-weight="600" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,${PAD + CW + 16},${netY})">NET</text>`;
  return svg;
}

function playerSVG(id, x, y, opacity, interactive, frameNum) {
  const team = id[0]; // A or B
  const color = TEAM_COLORS[team];
  const op = opacity || 1;
  let svg = '';
  if (interactive) {
    svg += `<circle cx="${x}" cy="${y}" r="${PR}" fill="${color}" opacity="${op}" class="player-circle" data-player="${id}" onmousedown="startDrag(event,'${id}')" ontouchstart="startDrag(event,'${id}')"/>`;
  } else {
    svg += `<circle cx="${x}" cy="${y}" r="${PR}" fill="${color}" opacity="${op}"/>`;
  }
  const label = frameNum !== undefined ? `${id}` : id;
  svg += `<text x="${x}" y="${y}" class="player-label" fill="#fff" font-size="12" opacity="${op}">${label}</text>`;
  return svg;
}

function shotSVG(shot, opacity) {
  if (!shot) return '';
  const c = SHOT_COLORS[shot.type];
  const op = opacity || 1;
  let svg = '';
  const arrowId = 'arrow_' + Math.random().toString(36).substr(2, 6);
  svg += `<defs><marker id="${arrowId}" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto"><polygon points="0 0, 14 5, 0 10" fill="${c}" opacity="${op}"/></marker></defs>`;

  if (shot.type === 'drop') {
    const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 - 40;
    svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="10,6" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  } else if (shot.type === 'drive') {
    svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="4.5" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  } else if (shot.type === 'smash') {
    svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="6" opacity="${op}" marker-end="url(#${arrowId})"/>`;
    svg += `<circle cx="${shot.x2}" cy="${shot.y2}" r="10" fill="none" stroke="${c}" stroke-width="3" opacity="${op * 0.6}"/>`;
    svg += `<circle cx="${shot.x2}" cy="${shot.y2}" r="18" fill="none" stroke="${c}" stroke-width="2" opacity="${op * 0.3}"/>`;
  } else if (shot.type === 'clear') {
    const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 - 80;
    svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="4" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  }
  const lx = (shot.x1 + shot.x2) / 2, ly = (shot.y1 + shot.y2) / 2 - 12;
  svg += `<text x="${lx}" y="${ly}" fill="${c}" font-size="15" font-family="system-ui" font-weight="700" text-anchor="middle" opacity="${op}">${SHOT_LABELS[shot.type]}</text>`;
  return svg;
}

function movementSVG(playerId, fromX, fromY, toX, toY, opacity) {
  const team = playerId[0];
  const c = TEAM_COLORS[team];
  const op = opacity || 1;
  const arrowId = 'marr_' + Math.random().toString(36).substr(2, 6);
  let svg = '';
  svg += `<defs><marker id="${arrowId}" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="${c}" opacity="${op * 0.8}"/></marker></defs>`;
  svg += `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${c}" stroke-width="3.5" stroke-dasharray="8,4" opacity="${op * 0.8}" marker-end="url(#${arrowId})"/>`;
  return svg;
}

function frameNumberBadge(num, x, y) {
  const badges = ['①', '②', '③', '④', '⑤', '⑥'];
  return `<text x="${x}" y="${y}" fill="#fff" font-size="22" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central" filter="url(#shadow)">${badges[num] || num + 1}</text>`;
}

function escapeXML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
