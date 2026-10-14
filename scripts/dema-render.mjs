#!/usr/bin/env node
// DEMA batch renderer: JSON scene spec(s) -> one PNG per frame + metadata JSON.
//
// Loads index.html in headless Chromium (Playwright, like agent-driver.mjs),
// feeds each scene to window.BF.loadScene(), rasterizes every frame with
// BF.exportDemaPNG(), strips PNG metadata chunks, and writes:
//
//   <out>/<scene name>/frame_00.png, frame_01.png, ...
//   <out>/<scene name>/metadata.json   (grader-side: image size, court-metres
//                                       -> pixel matrix, height-strip mapping,
//                                       per-frame positions, PNG sha256)
//
// Usage:
//   node scripts/dema-render.mjs <scene.json> [more.json ...] [--out DIR] [--check] [--svg]
//
//   --out DIR  output root (default scripts/out/dema)
//   --check    render everything a second time in a fresh browser launch and
//              fail (exit 2) unless every PNG is byte-identical
//   --svg      also write frame_NN.svg next to each PNG
//
// Setup (dev-only, same as agent-driver.mjs):
//   npm i -D playwright && npx playwright install chromium
//
// DEMA policy: this is generator tooling. For a real task, running it to
// produce input_images (and authoring anything agent-visible) is done by
// Avocado. metadata.json is grader-side only — never ship it to the agent.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';
import { startStaticServer } from './lib/static-server.mjs';
import { stripPngMetadata } from './lib/png-strip.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Flags that keep Chromium's rasterization stable run to run.
const CHROMIUM_ARGS = [
  '--disable-gpu',
  '--force-color-profile=srgb',
  '--disable-lcd-text',
  '--font-render-hinting=none',
];

function parseArgs(argv) {
  const args = { scenes: [], out: join(__dirname, 'out', 'dema'), check: false, svg: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = resolve(argv[++i]);
    else if (a === '--check') args.check = true;
    else if (a === '--svg') args.svg = true;
    else if (a.startsWith('--')) throw new Error('Unknown option ' + a);
    else args.scenes.push(resolve(a));
  }
  if (args.scenes.length === 0) {
    throw new Error(
      'usage: node scripts/dema-render.mjs <scene.json> [...] [--out DIR] [--check] [--svg]'
    );
  }
  return args;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function sceneName(spec, file) {
  const raw = spec.name || basename(file).replace(/\.json$/i, '');
  return String(raw).replace(/[^A-Za-z0-9._-]/g, '_');
}

// Render every scene in one fresh browser launch. Returns
// [{ name, file, frames: [{ png, svg, sha256, removed }], meta }].
async function renderAll(playwright, url, scenes) {
  const browser = await playwright.chromium.launch({ args: CHROMIUM_ARGS });
  const browserVersion = browser.version();
  const results = [];
  try {
    for (const { file, spec } of scenes) {
      // Fresh context per scene: no localStorage carried between scenes.
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      await page.addInitScript(() => {
        try {
          localStorage.setItem('bf-welcomed', '1');
          localStorage.setItem('bf-onboarded', '1');
        } catch {
          /* ignore */
        }
      });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.BF && window.BF.loadScene);

      const rendered = await page.evaluate(async (sceneSpec) => {
        const BF = window.BF;
        BF.loadScene(sceneSpec);
        const n = BF.getState().frames.length;
        const frames = [];
        for (let i = 0; i < n; i++) {
          const svg = BF.renderDemaSVG(i).svg;
          const png = await BF.exportDemaPNG(i);
          frames.push({ svg: svg, dataUrl: png.dataUrl });
        }
        return { frames: frames, meta: BF.demaMetadata() };
      }, spec);
      await context.close();
      if (pageErrors.length) throw new Error(file + ': page errors: ' + pageErrors.join('; '));

      const frames = rendered.frames.map((f) => {
        const raw = Buffer.from(f.dataUrl.slice(f.dataUrl.indexOf(',') + 1), 'base64');
        const { png, removed } = stripPngMetadata(raw);
        return { png, svg: f.svg, sha256: sha256(png), removed };
      });
      results.push({ name: sceneName(spec, file), file, frames, meta: rendered.meta });
    }
  } finally {
    await browser.close();
  }
  return { results, browserVersion };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error(
      'Playwright is not installed. Run:\n  npm i -D playwright\n  npx playwright install chromium'
    );
    process.exit(1);
  }

  const scenes = [];
  for (const file of args.scenes) {
    scenes.push({ file, spec: JSON.parse(await readFile(file, 'utf8')) });
  }

  const { server, port } = await startStaticServer(ROOT);
  const url = `http://127.0.0.1:${port}/index.html`;
  let run1;
  let run2 = null;
  try {
    run1 = await renderAll(playwright, url, scenes);
    if (args.check) run2 = await renderAll(playwright, url, scenes);
  } finally {
    server.close();
  }

  let mismatches = 0;
  for (let s = 0; s < run1.results.length; s++) {
    const r = run1.results[s];
    const dir = join(args.out, r.name);
    await mkdir(dir, { recursive: true });
    const removed = new Set();
    r.frames.forEach((f, i) => {
      f.file = `frame_${String(i).padStart(2, '0')}.png`;
      f.removed.forEach((t) => removed.add(t));
      if (run2 && run2.results[s].frames[i].sha256 !== f.sha256) mismatches++;
    });
    for (let i = 0; i < r.frames.length; i++) {
      const f = r.frames[i];
      await writeFile(join(dir, f.file), f.png);
      if (args.svg) await writeFile(join(dir, f.file.replace(/\.png$/, '.svg')), f.svg);
      r.meta.frames[i].file = f.file;
      r.meta.frames[i].sha256 = f.sha256;
    }
    const meta = Object.assign(
      {
        scene: { name: r.name, specFile: basename(r.file) },
        chromium: run1.browserVersion,
        pngChunksRemoved: Array.from(removed).sort(),
      },
      r.meta
    );
    if (run2) {
      meta.determinism = {
        runs: 2,
        separateBrowserLaunches: true,
        identical: r.frames.every((f, i) => run2.results[s].frames[i].sha256 === f.sha256),
      };
    }
    await writeFile(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(`Wrote ${r.frames.length} frame(s) + metadata.json to ${dir}`);
  }

  if (run2) {
    if (mismatches) {
      console.error(`Determinism check FAILED: ${mismatches} PNG(s) differ between runs.`);
      process.exit(2);
    }
    const total = run1.results.reduce((n, r) => n + r.frames.length, 0);
    console.log(
      `Determinism check passed: ${total} PNG(s) byte-identical across 2 browser launches.`
    );
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
