# Badminton Formation Tool — UX Audit & Redesign

## Summary
Comprehensive UX overhaul of https://alexshung.github.io/badminton-formation/
Repo: https://github.com/alexshung/badminton-formation.git

Commit: 4eeab44 — "UX Pro Coach Upgrade — v2"

---

## Problems Found

### Shot Drawing (BIGGEST FRICTION)
- **Before:** Click Shot tool → open sidebar → pick shot type → close sidebar → tap court → "Tap closer to a player" ERROR → frustration
- **6+ clicks/taps to draw a single shot**
- No visual feedback on where shot originates from
- "Click near a player" was vague and error-prone

### Formation Presets
- Buried in sidebar — coach has to open sidebar every time
- 8 presets hidden behind a menu
- No quick-access to common formations

### Timeline / Frames
- Frame buttons too small (30px) — hard to tap on mobile
- Duplicate frame: hotkey D only, no visible button
- Frame labels not visible in timeline
- Max 6 frames (limiting for long rallies)

### Onboarding
- 4 full-screen overlay cards blocking the court
- Overwhelming for first-time users
- Covered the entire interface

### Export / Share
- Export hidden in dropdown menu
- Share button low-contrast, easy to miss
- No instant export option

### General
- Tool switching is modal (must explicitly switch Player ↔ Shot)
- No keyboard shortcuts for shot types
- No way to quickly clear a shot
- Touch targets too small in places

---

## Solutions Implemented

### 1. Shot Tray — Always Visible
**Location:** Floating at bottom-center of court
- 6 shot buttons: Drop / Drive / Smash / Clear / Lift / Serve
- Color-coded dots matching shot trajectory colors
- Tap = instantly switch to shot tool + select that shot type
- **1 tap instead of 6**
- Clear shot ✕ button included

**Impact:** Shot drawing goes from 6 clicks → 1 click

### 2. Auto-Snap Shot Origins
- Removed "Tap closer to a player" error entirely
- Shots automatically snap to nearest player on court
- No distance threshold — always works
- Much more forgiving, feels natural

**Impact:** Zero shot placement failures

### 3. Shot-Mode Player Hover Rings
- When in shot mode, all players get a dashed ring around them
- Visual cue: "these are valid shot origins"
- Color-matched to team
- Reduces confusion about where to tap

**Impact:** Clear visual affordance, no guessing

### 4. Quick Formation Rail
**Location:** Left edge of court (desktop)
- 4 one-click pills: ⚡ Attack / 🛡️ Defense / 🔄 Rotate / 🎯 Serve
- Hover slides out with accent glow
- Instant formation application
- Hidden on mobile (too cramped — sidebar presets still available)

**Impact:** Common formations in 1 click instead of: open sidebar → scroll → tap preset → close sidebar

### 5. Timeline Redesign
- Frame buttons: 30px → 40px (easier to tap)
- Per-frame duplicate button (⧉) — appears on hover
- Frame labels shown in timeline (not just "F1, F2")
- Max frames: 6 → 8
- Cleaner layout, better spacing

**Impact:** Easier frame management, especially on touch devices

### 6. Compact Onboarding
**Before:** 4 full-screen cards covering the court
**After:** Single tip bar at bottom
- "💡 Drag players to move • Tap court to shoot • Use ←→ to switch frames • Press ? for help"
- Non-blocking, dismissible with ✕
- Auto-hides after first visit
- Much less intrusive

**Impact:** Get coaching in 5 seconds instead of clicking through 4 screens

### 7. Prominent Export
- "📷 Export" button is now primary CTA in top bar (blue)
- One-click PNG export
- Dropdown (▾) still offers Video export
- Share link still available

**Impact:** Export is obvious and instant

### 8. Keyboard Shortcuts
New shot hotkeys:
- **Q** = Drop
- **W** = Drive
- **E** = Smash
- **R** = Clear
- **T** = Lift
- **Y** = Serve
- **C** = Clear shot

Existing:
- **1-4** = Select players
- **Space** = Play animation
- **D** = Duplicate frame
- **Ctrl+Z** = Undo
- **?** = Help

**Impact:** Power users can coach at full speed without touching mouse

### 9. Visual Polish
- Shot hover rings
- Haptic feedback on mobile (vibrate on shot type change, frame duplicate)
- Larger touch targets throughout
- Better contrast on buttons
- Smoother animations

---

## Before / After

| Task | Before | After |
|------|--------|-------|
| Draw a smash | 6 clicks | **1 click** |
| Switch shot type | Open sidebar → pick → close | **Tap tray** |
| Apply Attack formation | Open sidebar → find preset → tap → close | **1 tap** (left rail) |
| Duplicate a frame | Press D (undiscoverable) | **Hover → click ⧉** |
| Clear a shot | Right-click → delete | **Press C / tap ✕** |
| First-time onboarding | 4 screens, blocks court | **1 tip bar, non-blocking** |
| Export diagram | Click Export ▾ → click PNG | **Click Export** |

---

## Technical Changes

**Files modified:**
- `index.html` — Added shot tray, formation rail, compact onboarding, prominent export button, updated help modal
- `styles.css` — Shot tray styles, formation rail styles, bigger timeline, onboarding tip styles, mobile responsive tweaks
- `interactions.js` — `setShotTypeQuick()`, shot auto-snap (removed distance threshold), keyboard shortcuts Q/W/E/R/T/Y + C, haptic feedback
- `app.js` — Timeline rendering with per-frame duplicate buttons, frame labels
- `state.js` — `clearShot()`, `duplicateFrameAt()`, max frames 6→8
- `court.js` — Shot-mode player hover rings

**Lines changed:** +220 / -90 across 6 files

**Breaking changes:** None — fully backward compatible, all existing diagrams load correctly

---

## Coaching Tool Comparison

Researched similar tools for inspiration:
- **Tactical Boards** (soccer/basketball/volleyball) — multi-sport, cloud sync, team management
- **CoachNotes Soccer** — magnetic board metaphor, drill library, animation mode
- **Coach Tactic Board: Volley** — 16 line types, player photos, folders, PDF export

Key patterns borrowed:
- Always-visible tool palette (like magnetic board)
- One-tap formation presets
- Visual hover feedback
- Big, tappable timeline
- Keyboard shortcuts for power users

---

## Live Site
https://alexshung.github.io/badminton-formation/

Cache-busted at v=1781065000 — hard refresh if needed.

---

## Next Suggested Improvements
1. Formation library — save/load custom formations
2. Shot trajectory editor — drag control points to adjust arc
3. Player trails — show movement history across frames
4. Court zone overlay toggle — front/mid/back zones
5. Share with preview image — og:image for social sharing
6. Swipe timeline on mobile — left/right swipe to change frames
7. Pinch-to-zoom court
8. Auto-animate between frames with easing
9. Export as GIF / MP4 with labels baked in
10. Collaborative editing — share link with live cursors
