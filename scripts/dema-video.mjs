#!/usr/bin/env node
// DEMA video renderer: a dense scene JSON -> deterministic WebM (VP9) + metadata.
//
// The in-app WebM export (export.js, MediaRecorder) records in real time from
// a canvas, so its bytes depend on wall-clock timing and machine load. DEMA
// inputs must be reproducible, so this path never records: it rasterizes every
// frame with scripts/dema-render.mjs (byte-stable PNGs, determinism-checked)
// and encodes them with ffmpeg using single-threaded, bitexact libvpx-vp9
// settings at a fixed frame rate.
//
// The scene's frames[] must already be sampled at 1/fps spacing (one scene
// frame per video frame). Turn "timestamps": false on for video variants if
// the task wants the solver to time motion from the frames themselves.
//
// Usage:
//   node scripts/dema-video.mjs <scene.json> [--fps 25] [--out DIR] [--crf 32] [--check] [--keep-frames]
//
//   --fps N        output frame rate (default 25); must match the scene's frame spacing
//   --out DIR      output root (default scripts/out/dema-video); writes DIR/<name>/video.webm
//   --crf N        VP9 constant quality (default 32; lower = larger, sharper)
//   --check        encode twice and fail (exit 2) unless the two WebMs are byte-identical
//   --keep-frames  move the intermediate PNGs to DIR/<name>/frames/ (default: left in the OS temp dir)
//
// Needs ffmpeg with libvpx-vp9 on PATH (or FFMPEG=/path/to/ffmpeg) and the same
// Playwright setup as dema-render.mjs. metadata.json is grader-side only.

import { readFile, mkdir, writeFile, readdir, rename, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

function parseArgs(argv) {
  const a = {
    scene: null,
    fps: 25,
    out: join(__dirname, 'out', 'dema-video'),
    crf: 32,
    check: false,
    keep: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--fps') a.fps = Number(argv[++i]);
    else if (v === '--out') a.out = resolve(argv[++i]);
    else if (v === '--crf') a.crf = Number(argv[++i]);
    else if (v === '--check') a.check = true;
    else if (v === '--keep-frames') a.keep = true;
    else if (v.startsWith('--')) throw new Error('Unknown option ' + v);
    else if (a.scene) throw new Error('one scene per call');
    else a.scene = resolve(v);
  }
  if (!a.scene)
    throw new Error(
      'usage: node scripts/dema-video.mjs <scene.json> [--fps 25] [--out DIR] [--check]'
    );
  if (!(a.fps > 0) || !Number.isFinite(a.fps)) throw new Error('--fps must be a positive number');
  return a;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function checkSpacing(spec, fps) {
  const ts = (spec.frames || []).map((f) => f.t);
  if (ts.length < 2 || ts.some((t) => typeof t !== 'number')) {
    throw new Error('scene needs >= 2 frames, each with a numeric t');
  }
  const dt = 1 / fps;
  for (let i = 1; i < ts.length; i++) {
    if (Math.abs(ts[i] - ts[i - 1] - dt) > 0.002) {
      throw new Error(
        `frame ${i}: spacing ${(ts[i] - ts[i - 1]).toFixed(4)} s != 1/fps = ${dt.toFixed(4)} s`
      );
    }
  }
}

function encode(framesDir, fps, crf, outFile) {
  // Single-threaded, bitexact, fixed GOP: same input PNGs -> same WebM bytes
  // for a given ffmpeg/libvpx build (recorded in metadata).
  execFileSync(
    FFMPEG,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-framerate',
      String(fps),
      '-start_number',
      '0',
      '-i',
      join(framesDir, 'frame_%02d.png'),
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      String(crf),
      '-b:v',
      '0',
      '-deadline',
      'good',
      '-cpu-used',
      '1',
      '-threads',
      '1',
      '-row-mt',
      '0',
      '-tile-columns',
      '0',
      '-frame-parallel',
      '0',
      '-g',
      String(Math.round(fps * 2)),
      '-auto-alt-ref',
      '0',
      '-fflags',
      '+bitexact',
      '-flags',
      '+bitexact',
      '-map_metadata',
      '-1',
      '-metadata',
      'encoder=',
      '-f',
      'webm',
      outFile,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const spec = JSON.parse(await readFile(a.scene, 'utf8'));
  checkSpacing(spec, a.fps);
  const name = String(spec.name || basename(a.scene).replace(/\.json$/i, '')).replace(
    /[^A-Za-z0-9._-]/g,
    '_'
  );
  const dir = join(a.out, name);
  await mkdir(dir, { recursive: true });

  // 1) Rasterize every frame with the determinism-checked PNG renderer.
  const tmpRoot = await mkdtemp(join(tmpdir(), 'dema-video-'));
  execFileSync(
    process.execPath,
    [join(__dirname, 'dema-render.mjs'), a.scene, '--out', tmpRoot, '--check'],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
    }
  );
  const framesDir = join(tmpRoot, name);
  const pngMeta = JSON.parse(await readFile(join(framesDir, 'metadata.json'), 'utf8'));

  // 2) Encode (twice with --check).
  const out1 = join(dir, 'video.webm');
  encode(framesDir, a.fps, a.crf, out1);
  const bytes1 = await readFile(out1);
  let identical = null;
  if (a.check) {
    const out2 = join(tmpRoot, 'video-check.webm');
    encode(framesDir, a.fps, a.crf, out2);
    identical = sha256(await readFile(out2)) === sha256(bytes1);
  }
  const ffv = execFileSync(FFMPEG, ['-hide_banner', '-version']).toString().split('\n')[0];
  const nFrames = spec.frames.length;
  const meta = {
    scene: { name, specFile: basename(a.scene) },
    video: {
      file: 'video.webm',
      codec: 'vp9',
      container: 'webm',
      fps: a.fps,
      frames: nFrames,
      duration_s: Number((nFrames / a.fps).toFixed(3)),
      crf: a.crf,
      bytes: bytes1.length,
      sha256: sha256(bytes1),
      ffmpeg: ffv,
    },
    timestamps_drawn: spec.timestamps !== false,
    png_frames: {
      chromium: pngMeta.chromium,
      determinism: pngMeta.determinism,
      image: pngMeta.image,
    },
    mapping: pngMeta.mapping || null,
    frame_t_s: spec.frames.map((f) => f.t),
  };
  if (a.check) meta.video.determinism = { encodes: 2, identical };
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2) + '\n');

  // 3) Keep or set aside the intermediate PNGs (never deleted in place).
  if (a.keep) {
    await mkdir(join(dir, 'frames'), { recursive: true });
    for (const f of await readdir(framesDir)) {
      if (f.endsWith('.png')) await rename(join(framesDir, f), join(dir, 'frames', f));
    }
  }
  // Without --keep-frames the PNGs stay in the OS temp dir (never deleted here).
  console.log(`Wrote ${out1} (${nFrames} frames @ ${a.fps} fps, ${bytes1.length} bytes)`);
  if (a.check) {
    if (!identical) {
      console.error('Determinism check FAILED: the two WebM encodes differ.');
      process.exit(2);
    }
    console.log('Determinism check passed: 2 encodes byte-identical.');
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
