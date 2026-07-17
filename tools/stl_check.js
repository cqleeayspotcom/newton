#!/usr/bin/env node
/**
 * stl_check.js - Binary STL validator (zero dependencies, Node built-ins only).
 *
 * Checks: binary STL structure, watertightness (manifold edges), degenerate
 * triangles, and bounding-box dimension ranges suitable for a shoe insole.
 *
 * Exit code 0 only if: parses AND watertight AND (dims in range OR --no-dim)
 * AND zero degenerate triangles. Otherwise 1.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const USAGE = `Usage: node stl_check.js [options] <file.stl>
Validates a binary STL file (structure, watertightness, degeneracy, dimensions).

Options:
  --json                Emit single-line JSON result instead of human summary
  --no-dim              Skip dimension range checks
  --tol <mm>            Vertex fuse tolerance (default 1e-4)
  --area-tol <mm^2>     Degenerate-triangle area tolerance (default 1e-6)
  --min-len/--max-len   Length range, mm (default 150-330)
  --min-wid/--max-wid   Width range, mm (default 40-140)
  --min-thk/--max-thk   Thickness range, mm (default 1-60)
  --selftest            Run internal self-verification and exit
  --help                Show this help`;

// ---------------------------------------------------------------------------
// Core checker
// ---------------------------------------------------------------------------

function checkSTL(filePath, opts) {
  const result = {
    valid: false,
    watertight: false,
    triangles: 0,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    degenerate: 0,
    bbox: { x: 0, y: 0, z: 0 },
    dims: { length: 0, width: 0, thickness: 0 },
    dimsInRange: false,
    errors: [],
  };

  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch (e) {
    result.errors.push(`cannot read file: ${e.message}`);
    return result;
  }

  if (buf.length < 84) {
    result.errors.push(`file too small (${buf.length} bytes; binary STL needs >= 84)`);
    return result;
  }

  const count = buf.readUInt32LE(80);
  const expected = 84 + 50 * count;
  if (buf.length !== expected) {
    if (buf.slice(0, 6).toString('ascii') === 'solid ') {
      result.errors.push('looks like ASCII STL (starts with "solid " and size does not match binary layout); binary STL required');
    } else {
      result.errors.push(`size mismatch: expected 84 + 50*${count} = ${expected} bytes, got ${buf.length}`);
    }
    return result;
  }
  result.triangles = count;
  if (count === 0) {
    result.errors.push('zero triangles');
    return result;
  }

  const tol = opts.tol;
  const q = (v) => Math.round(v / tol); // quantize coordinate to fuse vertices
  const edges = new Map(); // canonical edge key -> use count

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const base = 84 + 50 * i + 12; // skip normal
    const keys = new Array(3);
    const vx = new Array(3), vy = new Array(3), vz = new Array(3);
    for (let v = 0; v < 3; v++) {
      const o = base + 12 * v;
      const x = buf.readFloatLE(o), y = buf.readFloatLE(o + 4), z = buf.readFloatLE(o + 8);
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        result.errors.push(`non-finite vertex in triangle ${i}`);
        return result;
      }
      vx[v] = x; vy[v] = y; vz[v] = z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      keys[v] = q(x) + ',' + q(y) + ',' + q(z);
    }
    // degenerate: area = |cross(v1-v0, v2-v0)| / 2
    const ax = vx[1] - vx[0], ay = vy[1] - vy[0], az = vz[1] - vz[0];
    const bx = vx[2] - vx[0], by = vy[2] - vy[0], bz = vz[2] - vz[0];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (area < opts.areaTol) result.degenerate++;

    for (let e = 0; e < 3; e++) {
      const a = keys[e], b = keys[(e + 1) % 3];
      if (a === b) continue; // collapsed edge (degenerate); skip
      const key = a < b ? a + '|' + b : b + '|' + a;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }

  for (const n of edges.values()) {
    if (n === 1) result.boundaryEdges++;
    else if (n > 2) result.nonManifoldEdges++;
  }
  result.watertight = result.boundaryEdges === 0 && result.nonManifoldEdges === 0;

  result.bbox = {
    x: +(maxX - minX).toFixed(4),
    y: +(maxY - minY).toFixed(4),
    z: +(maxZ - minZ).toFixed(4),
  };
  const sorted = [result.bbox.x, result.bbox.y, result.bbox.z].sort((p, r) => r - p);
  result.dims = { length: sorted[0], width: sorted[1], thickness: sorted[2] };

  if (opts.noDim) {
    result.dimsInRange = true;
  } else {
    const d = result.dims;
    result.dimsInRange =
      d.length >= opts.minLen && d.length <= opts.maxLen &&
      d.width >= opts.minWid && d.width <= opts.maxWid &&
      d.thickness >= opts.minThk && d.thickness <= opts.maxThk;
    if (!result.dimsInRange) {
      result.errors.push(
        `dims out of range: L=${d.length} (${opts.minLen}-${opts.maxLen}) ` +
        `W=${d.width} (${opts.minWid}-${opts.maxWid}) T=${d.thickness} (${opts.minThk}-${opts.maxThk})`);
    }
  }

  if (!result.watertight) {
    result.errors.push(`not watertight: ${result.boundaryEdges} boundary, ${result.nonManifoldEdges} non-manifold edges`);
  }
  if (result.degenerate > 0) {
    result.errors.push(`${result.degenerate} degenerate triangle(s)`);
  }

  result.valid = result.watertight && result.dimsInRange && result.degenerate === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Box mesh generator (reusable; used by --selftest)
// ---------------------------------------------------------------------------

/** Generate binary STL Buffer for an axis-aligned box [0,sx]x[0,sy]x[0,sz].
 *  12 triangles (2 per face), outward normals. dropTriangle: index to omit. */
function makeBoxSTL(sx, sy, sz, dropTriangle = -1) {
  const V = [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
    [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
  ];
  // CCW when viewed from outside
  const F = [
    [0, 2, 1], [0, 3, 2], // bottom (z=0, normal -z)
    [4, 5, 6], [4, 6, 7], // top (z=sz, normal +z)
    [0, 1, 5], [0, 5, 4], // front (y=0, normal -y)
    [2, 3, 7], [2, 7, 6], // back (y=sy, normal +y)
    [0, 4, 7], [0, 7, 3], // left (x=0, normal -x)
    [1, 2, 6], [1, 6, 5], // right (x=sx, normal +x)
  ];
  const tris = F.filter((_, i) => i !== dropTriangle);
  const buf = Buffer.alloc(84 + 50 * tris.length);
  buf.write('stl_check selftest box', 0, 'ascii');
  buf.writeUInt32LE(tris.length, 80);
  let o = 84;
  for (const [a, b, c] of tris) {
    const [p, q2, r] = [V[a], V[b], V[c]];
    const ux = q2[0] - p[0], uy = q2[1] - p[1], uz = q2[2] - p[2];
    const wx = r[0] - p[0], wy = r[1] - p[1], wz = r[2] - p[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    buf.writeFloatLE(nx, o); buf.writeFloatLE(ny, o + 4); buf.writeFloatLE(nz, o + 8);
    o += 12;
    for (const vtx of [p, q2, r]) {
      buf.writeFloatLE(vtx[0], o); buf.writeFloatLE(vtx[1], o + 4); buf.writeFloatLE(vtx[2], o + 8);
      o += 12;
    }
    buf.writeUInt16LE(0, o);
    o += 2;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Self test
// ---------------------------------------------------------------------------

function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stl_check-'));
  const good = path.join(dir, 'box.stl');
  const bad = path.join(dir, 'box_hole.stl');
  try {
    // (a) watertight 100x60x10 box -> PASS (with --no-dim off; 100mm length is
    // below insole length range, so use custom ranges that fit the box).
    fs.writeFileSync(good, makeBoxSTL(100, 60, 10));
    const optsA = { ...defaultOpts(), minLen: 90, maxLen: 110, minWid: 50, maxWid: 70, minThk: 5, maxThk: 20 };
    const a = checkSTL(good, optsA);
    if (!a.watertight) throw new Error(`box: expected watertight, got boundary=${a.boundaryEdges} nonManifold=${a.nonManifoldEdges}`);
    if (a.triangles !== 12) throw new Error(`box: expected 12 triangles, got ${a.triangles}`);
    if (a.degenerate !== 0) throw new Error(`box: expected 0 degenerate, got ${a.degenerate}`);
    if (!a.dimsInRange) throw new Error('box: expected dims in range');
    if (!a.valid) throw new Error(`box: expected PASS, errors=${JSON.stringify(a.errors)}`);
    const d = a.dims;
    if (Math.abs(d.length - 100) > 0.01 || Math.abs(d.width - 60) > 0.01 || Math.abs(d.thickness - 10) > 0.01) {
      throw new Error(`box: bad dims ${JSON.stringify(d)}`);
    }
    // (b) same box with one triangle removed -> NOT watertight -> FAIL
    fs.writeFileSync(bad, makeBoxSTL(100, 60, 10, 0));
    const b = checkSTL(bad, optsA);
    if (b.triangles !== 11) throw new Error(`holed box: expected 11 triangles, got ${b.triangles}`);
    if (b.watertight) throw new Error('holed box: expected NOT watertight');
    if (b.boundaryEdges !== 3) throw new Error(`holed box: expected 3 boundary edges, got ${b.boundaryEdges}`);
    if (b.valid) throw new Error('holed box: expected FAIL');
    console.log('SELFTEST OK');
    return 0;
  } catch (e) {
    console.error(`SELFTEST FAILED: ${e.message}`);
    return 1;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function defaultOpts() {
  return {
    json: false, noDim: false, tol: 1e-4, areaTol: 1e-6,
    minLen: 150, maxLen: 330, minWid: 40, maxWid: 140, minThk: 1, maxThk: 60,
  };
}

function main(argv) {
  const opts = defaultOpts();
  const files = [];
  const numFlags = {
    '--tol': 'tol', '--area-tol': 'areaTol',
    '--min-len': 'minLen', '--max-len': 'maxLen',
    '--min-wid': 'minWid', '--max-wid': 'maxWid',
    '--min-thk': 'minThk', '--max-thk': 'maxThk',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(USAGE); return 0; }
    if (a === '--selftest') return selftest();
    if (a === '--json') { opts.json = true; continue; }
    if (a === '--no-dim') { opts.noDim = true; continue; }
    if (a in numFlags) {
      const v = parseFloat(argv[++i]);
      if (!isFinite(v)) { console.error(`invalid value for ${a}`); return 1; }
      opts[numFlags[a]] = v;
      continue;
    }
    if (a.startsWith('--')) { console.error(`unknown flag: ${a}\n${USAGE}`); return 1; }
    files.push(a);
  }
  if (files.length !== 1) { console.log(USAGE); return files.length === 0 ? 0 : 1; }

  const r = checkSTL(files[0], opts);
  if (opts.json) {
    console.log(JSON.stringify(r));
  } else {
    console.log(`file:         ${files[0]}`);
    console.log(`triangles:    ${r.triangles}`);
    console.log(`watertight:   ${r.watertight ? 'yes' : 'no'} (boundary=${r.boundaryEdges}, non-manifold=${r.nonManifoldEdges})`);
    console.log(`degenerate:   ${r.degenerate}`);
    console.log(`bbox (mm):    x=${r.bbox.x} y=${r.bbox.y} z=${r.bbox.z}`);
    console.log(`dims (mm):    L=${r.dims.length} W=${r.dims.width} T=${r.dims.thickness}${opts.noDim ? ' (range check skipped)' : r.dimsInRange ? ' (in range)' : ' (OUT OF RANGE)'}`);
    for (const e of r.errors) console.log(`error:        ${e}`);
    console.log(r.valid ? 'PASS' : 'FAIL');
  }
  return r.valid ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
