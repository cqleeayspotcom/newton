import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

import type { InsoleSpec } from './insole-rules';
import { buildInsoleGeometry } from './insole-mesh';

/**
 * Binary STL export for the parametric insole (POC demo slice).
 *
 * Reuses the same watertight solid as the 3D viewer ({@link buildInsoleGeometry})
 * and serialises it to a binary STL via Three.js' {@link STLExporter}. Binary STL
 * is the print-ready format: an 80-byte header, a uint32 triangle count, then 50
 * bytes per triangle — so the byte length is always `84 + 50 × triangles`.
 */

/** Build the binary STL for one side and return its bytes + triangle count. */
export function buildInsoleStl(
  spec: InsoleSpec,
  side: 'left' | 'right' = 'left',
): { bytes: Uint8Array; triangles: number } {
  const geom = buildInsoleGeometry(spec, side);
  const mesh = new THREE.Mesh(geom);
  const view = new STLExporter().parse(mesh, { binary: true }) as DataView;
  geom.dispose();

  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  // Binary STL layout: 80-byte header + uint32 count + 50 bytes/triangle.
  const triangles = view.getUint32(80, true);
  return { bytes, triangles };
}

/** Deterministic, side-labelled download filename (asserted by the smoke suite). */
export function insoleStlFileName(
  spec: InsoleSpec,
  side: 'left' | 'right',
): string {
  return `newfoot-insole-${side}-eu${spec.footSizeEu}.stl`;
}

/** Build the binary STL and trigger a browser download. */
export function downloadInsoleStl(
  spec: InsoleSpec,
  side: 'left' | 'right' = 'left',
): void {
  const { bytes } = buildInsoleStl(spec, side);
  // Copy into a standalone ArrayBuffer so the Blob owns exactly these bytes.
  const blob = new Blob([bytes.slice()], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = insoleStlFileName(spec, side);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
