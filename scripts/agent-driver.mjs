#!/usr/bin/env node
// Headless agent driver for the Badminton Formation Tool.
//
// Loads index.html in a real (headless) Chromium via Playwright, drives the
// window.BF control API to build a formation, then writes a PNG (and, when the
// browser supports MediaRecorder, a WebM video) to scripts/out/.
//
// This is a DEV-ONLY tool. It is NOT referenced by index.html and adds no
// runtime dependency to the app. Playwright must be installed first:
//
//   npm i -D playwright
//   npx playwright install chromium
//   node scripts/agent-driver.mjs
//
// Everything is local: a tiny built-in static file server serves the repo root,
// so there is no external hosting or CDN involved.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(__dirname, 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

// ── Tiny local static server (no external deps) ─────────────────────────────
function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^(\.\.[/\\])+/, '');
        const filePath = join(rootDir, rel);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        const body = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function dataUrlToFile(dataUrl, outPath) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  await writeFile(outPath, Buffer.from(base64, 'base64'));
}

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error(
      'Playwright is not installed. Run:\n' +
        '  npm i -D playwright\n' +
        '  npx playwright install chromium\n' +
        'then re-run: node scripts/agent-driver.mjs'
    );
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const { server, port } = await startStaticServer(ROOT);
  const url = `http://127.0.0.1:${port}/index.html`;
  console.log('Serving repo at', url);

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Suppress the first-time onboarding overlay so it never covers exports.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bf-welcomed', '1');
      localStorage.setItem('bf-onboarded', '1');
    } catch {
      /* ignore */
    }
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.BF !== 'undefined' && window.BF.version);
  console.log('BF API version:', await page.evaluate(() => window.BF.version));

  // ── Example scenario: a simple 2-frame attacking rally ────────────────────
  await page.evaluate(() => {
    const BF = window.BF;
    const info = BF.courtInfo();
    const { minX, minY, maxX, maxY } = info.playingArea;
    const midX = (minX + maxX) / 2;

    BF.reset();
    BF.setTitle('Agent Demo — Front/Back Attack');

    // Frame 1: attackers (A) front-back at the bottom, defenders (B) up top.
    BF.setFrame(0);
    BF.addPlayer({ id: 'A1', x: midX, y: minY + (maxY - minY) * 0.82, label: 'Rear' });
    BF.addPlayer({ id: 'A2', x: midX, y: minY + (maxY - minY) * 0.6, label: 'Net' });
    BF.addPlayer({ id: 'B1', x: minX + (maxX - minX) * 0.35, y: minY + (maxY - minY) * 0.28 });
    BF.addPlayer({ id: 'B2', x: minX + (maxX - minX) * 0.65, y: minY + (maxY - minY) * 0.28 });
    // A1 smashes cross-court from the rear.
    BF.addShot({ type: 'smash', fromId: 'A1', toXY: { x: minX + (maxX - minX) * 0.3, y: minY + (maxY - minY) * 0.2 } });

    // Frame 2: B1 lifts back; A2 steps up to the net.
    BF.addFrame();
    BF.setFrame(1);
    BF.movePlayer('A2', midX, minY + (maxY - minY) * 0.5);
    BF.addShot({ type: 'lift', fromId: 'B1', toXY: { x: midX, y: minY + (maxY - minY) * 0.9 } });
  });

  // Export PNG via the API (returns a data URL we save to disk).
  const png = await page.evaluate(async () => {
    const res = await window.BF.exportPNG({ width: 1200, height: 630 });
    return res.dataUrl;
  });
  const pngPath = join(OUT_DIR, 'formation.png');
  await dataUrlToFile(png, pngPath);
  console.log('Wrote', pngPath);

  // Export video via the API. MediaRecorder may be unavailable in some headless
  // builds — handle that gracefully instead of failing the whole run.
  try {
    const video = await page.evaluate(async () => {
      const res = await window.BF.exportVideo({ width: 960, height: 540, speed: 1.5 });
      return res.dataUrl;
    });
    const videoPath = join(OUT_DIR, 'rally.webm');
    await dataUrlToFile(video, videoPath);
    console.log('Wrote', videoPath);
  } catch (err) {
    console.warn('Video export skipped:', err && err.message ? err.message : err);
  }

  await browser.close();
  server.close();
  console.log('Done. Output in', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
