import * as THREE from "three";
import type { DepthMode } from "@/lib/types/environment";

const MAX_POINTS = 80_000;
const SAMPLE_STEP = 12;

export class DepthPointAccumulator {
  private positions: number[] = [];
  private readonly seen = new Set<string>();
  private framesSampled = 0;
  depthMode: DepthMode = "none";

  get pointCount(): number {
    return this.positions.length / 3;
  }

  get frames(): number {
    return this.framesSampled;
  }

  reset(): void {
    this.positions = [];
    this.seen.clear();
    this.framesSampled = 0;
    this.depthMode = "none";
  }

  sampleFromFrame(
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    camera: THREE.PerspectiveCamera,
    depthUsage: XRDepthUsage | null
  ): number {
    const pose = frame.getViewerPose(referenceSpace);
    if (!pose) return 0;

    let added = 0;

    for (const view of pose.views) {
      if (depthUsage === "cpu-optimized") {
        added += this.sampleCpuDepth(frame, view, camera);
      }
    }

    this.framesSampled += 1;
    return added;
  }

  private sampleCpuDepth(
    frame: XRFrame,
    view: XRView,
    camera: THREE.PerspectiveCamera
  ): number {
    const depthInfo = frame.getDepthInformation?.(view);
    if (!depthInfo) return 0;

    this.depthMode = "cpu";

    const w = depthInfo.width;
    const h = depthInfo.height;
    let added = 0;

    for (let row = 0; row < h; row += SAMPLE_STEP) {
      for (let col = 0; col < w; col += SAMPLE_STEP) {
        if (this.positions.length / 3 >= MAX_POINTS) return added;

        const u = col / w;
        const v = row / h;

        let depthM = 0;
        try {
          depthM = depthInfo.getDepthInMeters(u, v);
        } catch {
          continue;
        }

        if (!Number.isFinite(depthM) || depthM <= 0.05 || depthM > 12) {
          continue;
        }

        const world = this.uvDepthToWorld(u, v, depthM, camera);
        if (!world) continue;

        const key = `${Math.round(world.x * 40)}|${Math.round(world.y * 40)}|${Math.round(world.z * 40)}`;
        if (this.seen.has(key)) continue;
        this.seen.add(key);

        this.positions.push(world.x, world.y, world.z);
        added += 1;
      }
    }

    return added;
  }

  markGpuDepth(): void {
    if (this.depthMode === "none") this.depthMode = "gpu";
  }

  /** Fallback: malha de pontos à frente da câmera quando não há depth API */
  sampleCameraFallback(camera: THREE.PerspectiveCamera): number {
    this.depthMode = "none";
    let added = 0;
    const step = 0.15;

    for (let u = 0.1; u <= 0.9; u += step) {
      for (let v = 0.2; v <= 0.8; v += step) {
        if (this.positions.length / 3 >= MAX_POINTS) return added;
        const depthM = 1.2 + (1 - v) * 2.5;
        const world = this.uvDepthToWorld(u, v, depthM, camera);
        if (!world) continue;

        const key = `${Math.round(world.x * 30)}|${Math.round(world.y * 30)}|${Math.round(world.z * 30)}`;
        if (this.seen.has(key)) continue;
        this.seen.add(key);

        this.positions.push(world.x, world.y, world.z);
        added += 1;
      }
    }

    this.framesSampled += 1;
    return added;
  }

  private uvDepthToWorld(
    u: number,
    v: number,
    depthM: number,
    camera: THREE.PerspectiveCamera
  ): THREE.Vector3 | null {
    const ndc = new THREE.Vector3(u * 2 - 1, -(v * 2 - 1), 0.5);
    ndc.unproject(camera);

    const dir = ndc.sub(camera.position).normalize();
    return camera.position.clone().add(dir.multiplyScalar(depthM));
  }

  toFloat32Array(): Float32Array {
    return new Float32Array(this.positions);
  }
}
