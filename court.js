// ===== COURT SVG GENERATION =====

function courtGradientDefs() {
  return `<defs>
    <linearGradient id="courtGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#237a3c"/>
      <stop offset="50%" stop-color="#1a5c2e"/>
      <stop offset="100%" stop-color="#237a3c"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.5"/></filter>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="netGlow"><feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
}

function courtLines() {
  let svg = '';
  const lw = 2;
  const lc = 'rgba(255,255,255,.85)';
  const lcd = 'rgba(255,255,255,.45)';

  // Court fill with gradient
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" rx="3" fill="url(#courtGrad)"/>`;
  // Subtle inner shadow
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" rx="3" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1"/>`;

  // Boundary (brightest)
  svg += `<rect x="${PAD}" y="${PAD}" width="${CW}" height="${CH}" fill="none" stroke="${lc}" stroke-width="${lw + 0.5}"/>`;

  // Side tramlines
  const ss = 46;
  svg += `<line x1="${PAD + ss}" y1="${PAD}" x2="${PAD + ss}" y2="${PAD + CH}" stroke="${lcd}" stroke-width="${lw * 0.6}"/>`;
  svg += `<line x1="${PAD + CW - ss}" y1="${PAD}" x2="${PAD + CW - ss}" y2="${PAD + CH}" stroke="${lcd}" stroke-width="${lw * 0.6}"/>`;

  // Net with glow
  const netY = PAD + CH / 2;
  svg += `<line x1="${PAD - 4}" y1="${netY}" x2="${PAD + CW + 4}" y2="${netY}" stroke="rgba(255,255,255,.15)" stroke-width="8" filter="url(#netGlow)"/>`;
  svg += `<line x1="${PAD}" y1="${netY}" x2="${PAD + CW}" y2="${netY}" stroke="rgba(255,255,255,.7)" stroke-width="2.5"/>`;
  // Net posts
  svg += `<circle cx="${PAD - 2}" cy="${netY}" r="3" fill="rgba(255,255,255,.5)"/>`;
  svg += `<circle cx="${PAD + CW + 2}" cy="${netY}" r="3" fill="rgba(255,255,255,.5)"/>`;

  // Short service lines
  const ssl = 198;
  svg += `<line x1="${PAD}" y1="${netY - ssl}" x2="${PAD + CW}" y2="${netY - ssl}" stroke="${lcd}" stroke-width="${lw * 0.6}"/>`;
  svg += `<line x1="${PAD}" y1="${netY + ssl}" x2="${PAD + CW}" y2="${netY + ssl}" stroke="${lcd}" stroke-width="${lw * 0.6}"/>`;

  // Long service lines
  const lsl = 76;
  svg += `<line x1="${PAD}" y1="${PAD + lsl}" x2="${PAD + CW}" y2="${PAD + lsl}" stroke="${lcd}" stroke-width="${lw * 0.4}" stroke-dasharray="4,4"/>`;
  svg += `<line x1="${PAD}" y1="${PAD + CH - lsl}" x2="${PAD + CW}" y2="${PAD + CH - lsl}" stroke="${lcd}" stroke-width="${lw * 0.4}" stroke-dasharray="4,4"/>`;

  // Center lines
  const cx = PAD + CW / 2;
  svg += `<line x1="${cx}" y1="${netY - ssl}" x2="${cx}" y2="${PAD}" stroke="${lcd}" stroke-width="${lw * 0.6}"/>`;
  svg += `<line x1="${cx}" y1="${netY + ssl}" x2="${cx}" y2="${PAD + CH}" stroke="${lcd}" stroke-width="${lw * 0.6}"/>`;

  // NET label
  svg += `<text x="${PAD + CW + 20}" y="${netY}" fill="rgba(255,255,255,.3)" font-size="13" font-family="system-ui" font-weight="700" text-anchor="middle" dominant-baseline="central" letter-spacing="2" transform="rotate(-90,${PAD + CW + 20},${netY})">NET</text>`;

  return svg;
}

function courtBaseSVG() {
  return courtGradientDefs() + courtLines();
}

function courtSVG(frameIdx, interactive) {
  return courtLines();
}

function playerSVG(id, x, y, opacity, interactive, frameNum) {
  const team = id[0];
  const color = TEAM_COLORS[team];
  const dimColor = TEAM_COLORS_DIM[team];
  const op = opacity || 1;
  const isSelected = interactive && (tool === 'player' || tool === 'movement') && selectedPlayer === id;
  const label = getPlayerLabel(id);
  const fontSize = label.length > 3 ? 10 : (label.length > 2 ? 11 : 13);
  let svg = '';

  // Selection ring
  if (isSelected) {
    svg += `<circle cx="${x}" cy="${y}" r="${PR + 7}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5,4" opacity="${op * 0.6}">`;
    svg += `<animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y}" to="360 ${x} ${y}" dur="4s" repeatCount="indefinite"/></circle>`;
    svg += `<circle cx="${x}" cy="${y}" r="${PR + 4}" fill="none" stroke="${color}" stroke-width="1" opacity="${op * 0.2}"/>`;
  }

  // Invisible hit target
  if (interactive) {
    svg += `<circle cx="${x}" cy="${y}" r="${HIT_R}" fill="transparent" data-player="${id}" style="cursor:grab;"/>`;
  }

  // Player circle
  const shadowFilter = `filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))`;
  if (interactive) {
    svg += `<circle cx="${x}" cy="${y}" r="${PR}" fill="${color}" opacity="${op}" class="player-circle" data-player="${id}" style="${shadowFilter};cursor:grab;" onmousedown="startDrag(event,'${id}')" ontouchstart="startDrag(event,'${id}')"/>`;
    // Inner highlight
    svg += `<circle cx="${x}" cy="${y - 3}" r="${PR - 6}" fill="rgba(255,255,255,.15)" opacity="${op}" style="pointer-events:none"/>`;
  } else {
    svg += `<circle cx="${x}" cy="${y}" r="${PR}" fill="${color}" opacity="${op}" style="${shadowFilter}"/>`;
    svg += `<circle cx="${x}" cy="${y - 3}" r="${PR - 6}" fill="rgba(255,255,255,.15)" opacity="${op}"/>`;
  }

  // Label
  svg += `<text x="${x}" y="${y + 1}" fill="#fff" font-size="${fontSize}" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central" opacity="${op}" style="pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.5)">${escapeXML(label)}</text>`;
  return svg;
}

function shotSVG(shot, opacity) {
  if (!shot) return '';
  const c = SHOT_COLORS[shot.type];
  const op = opacity || 1;
  let svg = '';
  const arrowId = 'a_' + Math.random().toString(36).substr(2, 6);
  svg += `<defs><marker id="${arrowId}" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto"><polygon points="0 0, 14 5, 0 10" fill="${c}" opacity="${op}"/></marker></defs>`;

  if (shot.type === 'drop') {
    const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 - 40;
    svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="8,5" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  } else if (shot.type === 'drive') {
    svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="4.5" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  } else if (shot.type === 'smash') {
    svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="6.5" opacity="${op}" marker-end="url(#${arrowId})"/>`;
    svg += `<circle cx="${shot.x2}" cy="${shot.y2}" r="10" fill="none" stroke="${c}" stroke-width="2.5" opacity="${op * 0.5}"/>`;
    svg += `<circle cx="${shot.x2}" cy="${shot.y2}" r="20" fill="none" stroke="${c}" stroke-width="1.5" opacity="${op * 0.25}"/>`;
  } else if (shot.type === 'clear') {
    const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 - 80;
    svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="4" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  }

  // Label with dark pill
  const lx = (shot.x1 + shot.x2) / 2, ly = (shot.y1 + shot.y2) / 2 - 14;
  const tw = SHOT_LABELS[shot.type].length * 6.5 + 12;
  svg += `<rect x="${lx - tw/2}" y="${ly - 9}" width="${tw}" height="18" rx="4" fill="rgba(0,0,0,.65)" opacity="${op}"/>`;
  svg += `<text x="${lx}" y="${ly + 1}" fill="${c}" font-size="11" font-family="system-ui" font-weight="700" text-anchor="middle" dominant-baseline="central" opacity="${op}">${SHOT_LABELS[shot.type]}</text>`;
  return svg;
}

function movementSVG(playerId, fromX, fromY, toX, toY, opacity) {
  const team = playerId[0];
  const c = TEAM_COLORS[team];
  const op = opacity || 1;
  const arrowId = 'm_' + Math.random().toString(36).substr(2, 6);
  let svg = '';
  svg += `<defs><marker id="${arrowId}" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="${c}" opacity="${op * 0.7}"/></marker></defs>`;
  svg += `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${c}" stroke-width="3.5" stroke-dasharray="7,4" opacity="${op * 0.7}" marker-end="url(#${arrowId})"/>`;
  return svg;
}

function frameNumberBadge(num, x, y) {
  return `<circle cx="${x}" cy="${y}" r="13" fill="rgba(0,0,0,.7)" stroke="rgba(255,255,255,.2)" stroke-width="1"/>` +
    `<text x="${x}" y="${y + 1}" fill="#fff" font-size="12" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central">${num + 1}</text>`;
}

function escapeXML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
