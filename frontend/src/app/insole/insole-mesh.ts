import * as THREE from 'three';

import type { InsoleSpec } from './insole-rules';

/**
 * Parametric insole mesh generator (POC demo slice — visualization only).
 *
 * Builds a watertight solid heightfield from the rule-engine {@link InsoleSpec}:
 * a footbed outline that tapers heel→toe, a raised medial arch, a cupped heel,
 * and an optional heel-wedge tilt. The result is a closed manifold (top
 * heightfield + flat bottom + perimeter walls) so the same geometry can later be
 * exported to a watertight STL for printing.
 *
 * Units are millimetres; the mesh is centred on the origin with length along Y,
 * width along X and height along +Z.
 */

const NX = 72; // segments along the length (heel → toe)
const NY = 28; // segments across the width
const BASE_THICKNESS_MM = 4; // footbed base under the arch/cup features

/** Half-width profile across the length: narrow heel, wide forefoot, rounded toe. */
function halfWidthFactor(t: number): number {
  // t: 0 = heel, 1 = toe. Smooth anatomical-ish outline, always > 0.
  const heel = 0.62 + 0.12 * Math.sin(Math.PI * Math.min(t / 0.18, 1)); // rounded heel
  const waist = 1 - 0.22 * Math.exp(-Math.pow((t - 0.42) / 0.14, 2)); // midfoot waist
  const forefoot = 1 - 0.55 * Math.pow(Math.max(0, (t - 0.82) / 0.18), 1.6); // toe taper
  return Math.max(0.35, heel * waist * forefoot);
}

/** Top-surface height (mm) at normalized length t and across-width s ∈ [-1, 1]. */
function topHeight(spec: InsoleSpec, t: number, s: number): number {
  let z = BASE_THICKNESS_MM;

  // Medial longitudinal arch: a bump peaking at the midfoot on the medial (s<0) side.
  const along = Math.exp(-Math.pow((t - 0.4) / 0.2, 2));
  const medial = Math.max(0, -s); // 0 lateral … 1 medial
  z += spec.archHeightMm * along * Math.pow(medial, 1.3);

  // Heel cup: raise the rim around the heel so the heel sits in a cradle.
  const heelZone = Math.exp(-Math.pow(t / 0.16, 2));
  const rim = Math.pow(Math.abs(s), 2.2);
  z += spec.heelCupDepthMm * heelZone * rim;

  // Heel wedge: linear medial/lateral tilt fading out of the heel region.
  if (spec.heelWedgeSide !== 'none' && spec.heelWedgeDeg > 0) {
    const wedgeZone = Math.exp(-Math.pow(t / 0.28, 2));
    const dir = spec.heelWedgeSide === 'medial' ? -1 : 1; // raise that side
    const tiltMm = Math.tan((spec.heelWedgeDeg * Math.PI) / 180) * 12; // over ~12mm half-width
    z += Math.max(0, dir * s) * tiltMm * wedgeZone;
  }

  return z;
}

/**
 * Build the insole as a closed (watertight) BufferGeometry from a spec.
 * `side: 'right'` mirrors the left-foot geometry across the width axis.
 */
export function buildInsoleGeometry(
  spec: InsoleSpec,
  side: 'left' | 'right' = 'left',
): THREE.BufferGeometry {
  const lengthMm = spec.lengthMm;
  const maxHalfWidth = spec.widthMm / 2;
  const cols = NY + 1;

  const positions: number[] = [];
  const indices: number[] = [];

  const topIndex = (i: number, j: number): number => i * cols + j;
  const gridCount = (NX + 1) * cols;
  const botIndex = (i: number, j: number): number => gridCount + i * cols + j;

  // Vertices: top heightfield then flat bottom (z = 0), same (i,j) layout.
  for (const layer of ['top', 'bottom'] as const) {
    for (let i = 0; i <= NX; i++) {
      const t = i / NX;
      const y = (t - 0.5) * lengthMm;
      const hw = halfWidthFactor(t) * maxHalfWidth;
      for (let j = 0; j <= NY; j++) {
        const s = (j / NY) * 2 - 1; // -1 … 1 across width
        const x = s * hw * (side === 'right' ? -1 : 1);
        const z = layer === 'top' ? topHeight(spec, t, s) : 0;
        positions.push(x, y, z);
      }
    }
  }

  // Top surface (normals up: +Z).
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const a = topIndex(i, j);
      const b = topIndex(i + 1, j);
      const c = topIndex(i + 1, j + 1);
      const d = topIndex(i, j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  // Bottom surface (normals down: reversed winding).
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const a = botIndex(i, j);
      const b = botIndex(i + 1, j);
      const c = botIndex(i + 1, j + 1);
      const d = botIndex(i, j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }
  // Perimeter walls connecting top edge loop to bottom edge loop.
  const wall = (t0: number, t1: number, b0: number, b1: number): void => {
    indices.push(t0, t1, b0, t1, b1, b0);
  };
  for (let i = 0; i < NX; i++) {
    // j = 0 edge and j = NY edge (with matching winding so outward normals stay consistent).
    wall(topIndex(i, 0), topIndex(i + 1, 0), botIndex(i, 0), botIndex(i + 1, 0));
    wall(topIndex(i + 1, NY), topIndex(i, NY), botIndex(i + 1, NY), botIndex(i, NY));
  }
  for (let j = 0; j < NY; j++) {
    // i = 0 (heel) and i = NX (toe) caps.
    wall(topIndex(0, j + 1), topIndex(0, j), botIndex(0, j + 1), botIndex(0, j));
    wall(topIndex(NX, j), topIndex(NX, j + 1), botIndex(NX, j), botIndex(NX, j + 1));
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}
