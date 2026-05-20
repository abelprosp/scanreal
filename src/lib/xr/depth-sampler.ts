import * as THREE from "three";
import type { DepthMode } from "@/lib/types/environment";

const MAX_POINTS = 150_000;

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

  private addPoint(x: number, y: number, z: number, precision = 22): boolean {
    if (this.positions.length / 3 >= MAX_POINTS) return false;

    const key = `${Math.round(x * precision)}|${Math.round(y * precision)}|${Math.round(z * precision)}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);

    this.positions.push(x, y, z);
    return true;
  }

  /** Volume denso à frente da câmera + chão + teto */
  sampleRoomVolume(camera: THREE.PerspectiveCamera): number {
    let added = 0;

    const depths = [0.35, 0.55, 0.8, 1.1, 1.5, 2.0, 2.6, 3.3, 4.2, 5.5, 6.5];
    const cols = 18;
    const rows = 12;

    for (const depthM of depths) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const u = (col + 0.5) / cols;
          const v = (row + 0.5) / rows;
          const world = this.uvDepthToWorld(u, v, depthM, camera);
          if (world && this.addPoint(world.x, world.y, world.z, 20)) added++;
        }
      }
    }

    const floorY = camera.position.y - 1.35;
    const cx = camera.position.x;
    const cz = camera.position.z;

    for (let x = -5; x <= 5; x += 0.28) {
      for (let z = -5; z <= 5; z += 0.28) {
        if (x * x + z * z > 28) continue;
        if (this.addPoint(cx + x, floorY, cz + z, 16)) added++;
      }
    }

    const ceilY = camera.position.y + 0.35;
    for (let x = -3.5; x <= 3.5; x += 0.4) {
      for (let z = -3.5; z <= 3.5; z += 0.4) {
        if (this.addPoint(cx + x, ceilY, cz + z, 18)) added++;
      }
    }

    this.framesSampled += 1;
    return added;
  }

  /** Paredes laterais e frontal em arco (completa o perímetro) */
  samplePerimeterArc(camera: THREE.PerspectiveCamera): number {
    let added = 0;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    const distances = [1.5, 2.2, 3.0, 4.0];
    const heights = [-0.8, -0.2, 0.5, 1.2, 1.9];

    for (const dist of distances) {
      for (const h of heights) {
        for (let t = -1; t <= 1; t += 0.25) {
          const offset = new THREE.Vector3()
            .addScaledVector(forward, dist)
            .addScaledVector(right, t * dist * 0.85);
          offset.y = h;
          if (
            this.addPoint(cx + offset.x, cy + offset.y, cz + offset.z, 18)
          ) {
            added++;
          }
        }
      }
    }

    return added;
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
    const step = 8;

    for (let row = 0; row < h; row += step) {
      for (let col = 0; col < w; col += step) {
        const u = col / w;
        const v = row / h;
        let depthM = 0;
        try {
          depthM = depthInfo.getDepthInMeters(u, v);
        } catch {
          continue;
        }
        if (!Number.isFinite(depthM) || depthM <= 0.05 || depthM > 12) continue;
        const world = this.uvDepthToWorld(u, v, depthM, camera);
        if (world && this.addPoint(world.x, world.y, world.z, 32)) added++;
      }
    }
    return added;
  }

  markGpuDepth(): void {
    if (this.depthMode === "none") this.depthMode = "gpu";
  }

  /** Captura completa para IA: volume + perímetro */
  sampleFullStation(camera: THREE.PerspectiveCamera): number {
    let a = this.sampleRoomVolume(camera);
    a += this.samplePerimeterArc(camera);
    return a;
  }

  sampleCameraFallback(camera: THREE.PerspectiveCamera): number {
    return this.sampleFullStation(camera);
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
