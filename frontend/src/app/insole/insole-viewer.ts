import {
  Component,
  ElementRef,
  Injector,
  effect,
  inject,
  input,
  viewChild,
  DestroyRef,
  afterNextRender,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { InsoleSpec } from './insole-rules';
import { buildInsoleGeometry } from './insole-mesh';

/**
 * Interactive Three.js viewer for the recommended insole (POC demo slice).
 * Renders the parametric mesh (see {@link buildInsoleGeometry}) and lets the
 * user orbit (drag) and zoom (scroll/pinch) around it. Client-side only.
 */
@Component({
  selector: 'nf-insole-viewer',
  standalone: true,
  template: `<div
    #host
    class="nf-viewer"
    data-testid="insole-viewer"
    role="img"
    aria-label="Interactive 3D model of the recommended insole"
  ></div>`,
  styles: [
    `
      .nf-viewer {
        display: block;
        width: 100%;
        height: 320px;
        border-radius: var(--nf-radius, 12px);
        border: 1px solid var(--nf-border);
        background:
          radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--nf-accent) 10%, transparent), transparent 60%),
          var(--nf-surface-2);
        overflow: hidden;
        cursor: grab;
        touch-action: none;
      }
      .nf-viewer:active {
        cursor: grabbing;
      }
      .nf-viewer canvas {
        display: block;
      }
    `,
  ],
})
export class InsoleViewer {
  readonly spec = input.required<InsoleSpec>();
  readonly side = input<'left' | 'right'>('left');

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private mesh?: THREE.Mesh;
  private frame = 0;
  private ro?: ResizeObserver;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const injector = inject(Injector);

    // Three.js touches the DOM/WebGL — defer to the browser render phase (SSR-safe).
    afterNextRender(() => {
      this.init();
      // Rebuild the mesh now and whenever the spec (foot size / findings) changes.
      effect(
        () => {
          const spec = this.spec();
          const side = this.side();
          this.rebuildMesh(spec, side);
        },
        { injector },
      );
    });

    destroyRef.onDestroy(() => this.dispose());
  }

  private init(): void {
    const el = this.host().nativeElement;
    const w = el.clientWidth || 480;
    const h = el.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 1, 4000);
    camera.position.set(120, -190, 170);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(80, -120, 220);
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.8);
    fill.position.set(-140, 120, 60);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.55));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 90; // zoom-in limit
    controls.maxDistance = 520; // zoom-out limit
    controls.target.set(0, 0, 8);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);

    const loop = (): void => {
      this.frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
      // Test hook: expose orbit state so the smoke suite can assert rotate/zoom.
      el.dataset['az'] = controls.getAzimuthalAngle().toFixed(3);
      el.dataset['dist'] = camera.position.distanceTo(controls.target).toFixed(1);
    };
    loop();
  }

  private rebuildMesh(spec: InsoleSpec, side: 'left' | 'right'): void {
    const scene = this.scene;
    if (!scene) return;

    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = undefined;
    }

    const geom = buildInsoleGeometry(spec, side);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3b5bfd,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: false,
    });
    const mesh = new THREE.Mesh(geom, material);

    // Centre the geometry on the origin so orbit stays framed as size changes.
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.position.set(-center.x, -center.y, -center.z);

    scene.add(mesh);

    // Frame the camera so the whole insole fits with a small margin.
    geom.computeBoundingSphere();
    const radius = geom.boundingSphere!.radius;
    const camera = this.camera;
    const controls = this.controls;
    if (camera && controls) {
      const fov = (camera.fov * Math.PI) / 180;
      const fit = (radius / Math.sin(fov / 2)) * 1.15;
      const dir = new THREE.Vector3(0.55, -0.8, 0.62).normalize();
      controls.target.set(0, 0, 0);
      camera.position.copy(dir.multiplyScalar(fit));
      controls.minDistance = fit * 0.45; // zoom-in limit
      controls.maxDistance = fit * 1.9; // zoom-out limit
      controls.update();
    }
  }

  private resize(): void {
    const el = this.host().nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h || !this.renderer || !this.camera) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private dispose(): void {
    cancelAnimationFrame(this.frame);
    this.ro?.disconnect();
    this.controls?.dispose();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
