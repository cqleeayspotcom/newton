#!/usr/bin/env node
/**
 * gen_y4m.js — generate small valid I420 .y4m clips for Chrome's fake camera
 * (--use-file-for-fake-video-capture). Zero deps. Reproducible.
 *
 * NOTE: these are SYNTHETIC patterns, not real humans — they exist so the
 * camera UI / <video> playback features work in automation. They will NOT
 * produce MediaPipe pose landmarks. Pose-metric correctness is covered by the
 * deterministic fixtures in tools/pose_fixtures/. To exercise the full pose
 * pipeline in-browser, drop a real royalty-free human-posture clip (front/side/
 * back), converted to I420 y4m, over these files keeping the same names.
 *
 * Usage: node tools/test_media/gen_y4m.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const W = 320;
const H = 240;
const FRAMES = 12;
const FPS = 15;

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

// pattern: 'v' vertical gradient, 'h' horizontal, 'd' diagonal. A moving block
// gives temporal motion so "video is playing" checks pass.
function makeClip(pattern, baseY) {
  const chunks = [];
  const header = `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`;
  chunks.push(Buffer.from(header, 'ascii'));

  const cw = W >> 1;
  const ch = H >> 1;

  for (let f = 0; f < FRAMES; f++) {
    const y = Buffer.alloc(W * H);
    const u = Buffer.alloc(cw * ch);
    const v = Buffer.alloc(cw * ch);

    // moving block position
    const bx = Math.floor(((f / FRAMES) * (W - 60)) | 0);
    const by = Math.floor((H / 2 - 30 + Math.sin((f / FRAMES) * Math.PI * 2) * 40) | 0);

    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let g;
        if (pattern === 'v') g = (j / H) * 200;
        else if (pattern === 'h') g = (i / W) * 200;
        else g = ((i + j) / (W + H)) * 200;
        let val = baseY + g;
        // draw moving bright block
        if (i >= bx && i < bx + 60 && j >= by && j < by + 60) val = 235;
        y[j * W + i] = clamp(val);
      }
    }
    // flat chroma (grayscale-ish) with a slight tint per pattern
    const uFill = pattern === 'v' ? 128 : pattern === 'h' ? 100 : 150;
    const vFill = pattern === 'v' ? 128 : pattern === 'h' ? 150 : 100;
    u.fill(uFill);
    v.fill(vFill);

    chunks.push(Buffer.from('FRAME\n', 'ascii'), y, u, v);
  }
  return Buffer.concat(chunks);
}

const outDir = __dirname;
const clips = [
  ['front.y4m', 'v', 20],
  ['side.y4m', 'h', 20],
  ['back.y4m', 'd', 20],
];

for (const [name, pattern, baseY] of clips) {
  const buf = makeClip(pattern, baseY);
  const p = path.join(outDir, name);
  fs.writeFileSync(p, buf);
  console.log(`wrote ${name} (${buf.length} bytes, ${W}x${H}, ${FRAMES} frames)`);
}
