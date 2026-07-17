#!/usr/bin/env node
/**
 * gen_person_y4m.mjs — build a REAL-human I420 .y4m clip for Chrome's fake camera
 * so the full MediaPipe pose pipeline (F035 skeleton overlay) can be exercised
 * end-to-end in automation.
 *
 * Unlike the synthetic patterns in gen_y4m.js (which contain no human and yield
 * NO landmarks), this decodes a royalty-free full-body photo and emits it as a
 * short looping clip. Chrome loops the file, so a handful of identical frames is
 * enough for a stable live preview + detection.
 *
 * Decoding is done via Playwright's bundled Chromium (already a smoke/ dep) —
 * canvas gives us RGBA, which we convert to planar I420 (BT.601). No ffmpeg
 * (the local build is arch-broken) and no image-decode npm deps.
 *
 * Usage: node tools/test_media/gen_person_y4m.mjs [input.jpg] [out.y4m]
 */
import pkg from '../../smoke/node_modules/playwright/index.js';
const { chromium } = pkg;
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inPath = resolve(process.argv[2] ?? '/tmp/person.jpg');
const outPath = resolve(process.argv[3] ?? `${__dirname}/person.y4m`);

const W = 480;
const H = 320;
const FPS = 15;
const FRAMES = 15; // ~1s; Chrome loops the clip

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

const jpgB64 = readFileSync(inPath).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
// Decode + resize (object-fit: cover) the JPEG on a canvas and read RGBA.
const rgba = await page.evaluate(
  async ({ b64, w, h }) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    // cover: scale to fill, center-crop
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return Array.from(ctx.getImageData(0, 0, w, h).data);
  },
  { b64: jpgB64, w: W, h: H },
);
await browser.close();

// RGBA -> planar I420 (BT.601 full-ish range, matches gen_y4m.js conventions).
const cw = W >> 1;
const ch = H >> 1;
const y = Buffer.alloc(W * H);
const u = Buffer.alloc(cw * ch);
const v = Buffer.alloc(cw * ch);

for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const p = (j * W + i) * 4;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    y[j * W + i] = clamp(0.299 * r + 0.587 * g + 0.114 * b);
  }
}
// 4:2:0 chroma: sample the top-left pixel of each 2x2 block.
for (let j = 0; j < ch; j++) {
  for (let i = 0; i < cw; i++) {
    const p = (j * 2 * W + i * 2) * 4;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    u[j * cw + i] = clamp(-0.169 * r - 0.331 * g + 0.5 * b + 128);
    v[j * cw + i] = clamp(0.5 * r - 0.419 * g - 0.081 * b + 128);
  }
}

const chunks = [Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`, 'ascii')];
for (let f = 0; f < FRAMES; f++) {
  chunks.push(Buffer.from('FRAME\n', 'ascii'), y, u, v);
}
const buf = Buffer.concat(chunks);
writeFileSync(outPath, buf);
console.log(`wrote ${outPath} (${buf.length} bytes, ${W}x${H}, ${FRAMES} frames, from ${inPath})`);
