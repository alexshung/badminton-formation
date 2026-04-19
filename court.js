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
    <pattern id="hatch-overlap" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,.5)" stroke-width="2"/>
    </pattern>
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

  // Invisible hit target (with event handlers for bigger touch area)
  if (interactive) {
    svg += `<circle cx="${x}" cy="${y}" r="${HIT_R}" fill="transparent" data-player="${id}" style="cursor:grab;" onmousedown="startDrag(event,'${id}')" ontouchstart="startDrag(event,'${id}')"/>`;
  }

  // Player circle
  const shadowFilter = `filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))`;
  if (interactive) {
    svg += `<circle cx="${x}" cy="${y}" r="${PR}" fill="${color}" opacity="${op}" class="player-circle" data-player="${id}" style="${shadowFilter};cursor:grab;pointer-events:none"/>`;
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
  } else if (shot.type === 'lift') {
    const mx = (shot.x1 + shot.x2) / 2, my = (shot.y1 + shot.y2) / 2 - 100;
    svg += `<path d="M${shot.x1},${shot.y1} Q${mx},${my} ${shot.x2},${shot.y2}" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="12,4" opacity="${op}" marker-end="url(#${arrowId})"/>`;
  } else if (shot.type === 'serve') {
    svg += `<line x1="${shot.x1}" y1="${shot.y1}" x2="${shot.x2}" y2="${shot.y2}" stroke="${c}" stroke-width="3.5" stroke-dasharray="3,3" opacity="${op}" marker-end="url(#${arrowId})"/>`;
    svg += `<circle cx="${shot.x1}" cy="${shot.y1}" r="8" fill="none" stroke="${c}" stroke-width="2" opacity="${op * 0.6}"/>`;
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

// ===== SHUTTLECOCK ICON =====
function shuttlecockSVG(x, y, opacity, interactive) {
  const op = opacity || 1;
  let svg = `<g transform="translate(${x},${y})" opacity="${op}">`;
  // Feather cone
  svg += `<path d="M-7,-18 Q0,-12 7,-18 L4,-3 Q0,0 -4,-3 Z" fill="rgba(255,255,255,0.85)" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/>`;
  // Feather vanes
  svg += `<line x1="-5" y1="-15" x2="-2" y2="-5" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/>`;
  svg += `<line x1="0" y1="-17" x2="0" y2="-5" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/>`;
  svg += `<line x1="5" y1="-15" x2="2" y2="-5" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/>`;
  // Cork ball
  svg += `<circle r="4.5" fill="#F5DEB3" stroke="#8B7355" stroke-width="1.5"/>`;
  svg += `<circle r="2" cy="-1" fill="rgba(255,255,255,0.3)"/>`;
  // Hit target for interaction
  if (interactive) {
    svg += `<circle r="${HIT_R}" fill="transparent" style="cursor:grab;" onmousedown="startShuttleDrag(event)" ontouchstart="startShuttleDrag(event)"/>`;
  } else {
    // Glow ring (only for non-interactive / decorative)
    svg += `<circle r="10" fill="none" stroke="rgba(255,255,200,0.4)" stroke-width="1.5">`;
    svg += `<animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite"/>`;
    svg += `<animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite"/>`;
    svg += `</circle>`;
  }
  svg += `</g>`;
  return svg;
}

// ===== COVERAGE REGION RENDERING =====

function regionSVG(regions, opacity) {
  if (!regions || Object.keys(regions).length === 0) return '';
  const op = opacity || 1;
  let svg = '';

  // Draw each player's region
  const playerIds = Object.keys(regions);
  for (const pid of playerIds) {
    const pts = regions[pid];
    if (!pts || pts.length < 3) continue;
    const team = pid[0];
    const color = TEAM_COLORS[team];
    const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');

    // Semi-transparent fill
    svg += `<polygon points="${pointsStr}" fill="${color}" fill-opacity="${0.15 * op}" stroke="${color}" stroke-width="2" stroke-opacity="${0.5 * op}" stroke-dasharray="6,4"/>`;

    // Player label inside region
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const label = getPlayerLabel(pid);
    svg += `<text x="${cx}" y="${cy}" fill="${color}" font-size="11" font-weight="700" font-family="system-ui" text-anchor="middle" dominant-baseline="central" opacity="${0.5 * op}">${escapeXML(label)}</text>`;
  }

  // Detect and render overlaps with hatching
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const ptsA = regions[playerIds[i]];
      const ptsB = regions[playerIds[j]];
      if (!ptsA || ptsA.length < 3 || !ptsB || ptsB.length < 3) continue;
      const overlap = computePolygonOverlap(ptsA, ptsB);
      if (overlap && overlap.length >= 3) {
        const overlapStr = overlap.map(p => `${p.x},${p.y}`).join(' ');
        svg += `<polygon points="${overlapStr}" fill="url(#hatch-overlap)" fill-opacity="${0.6 * op}" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-opacity="${op}"/>`;
      }
    }
  }

  return svg;
}

function coveragePreviewSVG(points, preview, playerId) {
  if (!points || points.length === 0) return '';
  const team = playerId[0];
  const color = TEAM_COLORS[team];
  let svg = '';

  // Draw existing points
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="0.8"/>`;
    if (i > 0) {
      svg += `<line x1="${points[i-1].x}" y1="${points[i-1].y}" x2="${p.x}" y2="${p.y}" stroke="${color}" stroke-width="2" opacity="0.6"/>`;
    }
  }

  // Preview line to cursor
  if (preview && points.length > 0) {
    const last = points[points.length - 1];
    svg += `<line x1="${last.x}" y1="${last.y}" x2="${preview.x}" y2="${preview.y}" stroke="${color}" stroke-width="2" stroke-dasharray="4,3" opacity="0.5"/>`;
    // Close preview back to first point
    svg += `<line x1="${preview.x}" y1="${preview.y}" x2="${points[0].x}" y2="${points[0].y}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.25"/>`;
  }

  // Highlight first point (close target)
  if (points.length >= 3) {
    svg += `<circle cx="${points[0].x}" cy="${points[0].y}" r="9" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3,2" opacity="0.5">`;
    svg += `<animate attributeName="r" values="9;12;9" dur="1.5s" repeatCount="indefinite"/></circle>`;
  }

  // Preview filled polygon
  if (points.length >= 3 && preview) {
    const allPts = [...points, preview];
    const pointsStr = allPts.map(p => `${p.x},${p.y}`).join(' ');
    svg += `<polygon points="${pointsStr}" fill="${color}" fill-opacity="0.08" stroke="none"/>`;
  }

  return svg;
}

// Sutherland-Hodgman polygon clipping for overlap detection
function computePolygonOverlap(subjectPoly, clipPoly) {
  let output = [...subjectPoly];
  if (output.length === 0) return [];

  for (let i = 0; i < clipPoly.length; i++) {
    if (output.length === 0) return [];
    const input = [...output];
    output = [];
    const edgeStart = clipPoly[i];
    const edgeEnd = clipPoly[(i + 1) % clipPoly.length];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currInside = isInsideEdge(current, edgeStart, edgeEnd);
      const prevInside = isInsideEdge(prev, edgeStart, edgeEnd);

      if (currInside) {
        if (!prevInside) {
          const inter = lineIntersection(prev, current, edgeStart, edgeEnd);
          if (inter) output.push(inter);
        }
        output.push(current);
      } else if (prevInside) {
        const inter = lineIntersection(prev, current, edgeStart, edgeEnd);
        if (inter) output.push(inter);
      }
    }
  }
  return output;
}

function isInsideEdge(point, edgeStart, edgeEnd) {
  return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
         (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >= 0;
}

function lineIntersection(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 0.001) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}
