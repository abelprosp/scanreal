import * as THREE from "three";
import type { DepthMode } from "@/lib/types/environment";

const MAX_POINTS = 100_000;

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

  private addPoint(x: number, y: number, z: number, precision = 25): boolean {
    if (this.positions.length / 3 >= MAX_POINTS) return false;

    const key = `${Math.round(x * precision)}|${Math.round(y * precision)}|${Math.round(z * precision)}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);

    this.positions.push(x, y, z);
    return true;
  }

  /**
   * Preenche volume tipo sala: várias distâncias + chão ao redor da câmera.
   * Evita o efeito "cortina" de um único plano.
   */
  sampleRoomVolume(camera: THREE.PerspectiveCamera): number {
    let added = 0;

    const depths = [0.4, 0.7, 1.0, 1.4, 1.9, 2.5, 3.2, 4.0, 5.0];
    const cols = 14;
    const rows = 10;

    for (const depthM of depths) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const u = (col + 0.5) / cols;
          const v = (row + 0.5) / rows;
          const world = this.uvDepthToWorld(u, v, depthM, camera);
          if (world && this.addPoint(world.x, world.y, world.z, 22)) added++;
        }
      }
    }

    const floorY = camera.position.y - 1.35;
    const cx = camera.position.x;
    const cz = camera.position.z;

    for (let x = -4; x <= 4; x += 0.35) {
      for (let z = -4; z <= 4; z += 0.35) {
        if (x * x + z * z > 16) continue;
        if (this.addPoint(cx + x, floorY, cz + z, 18)) added++;
      }
    }

    const ceilY = camera.position.y + 0.25;
    for (let x = -2.5; x <= 2.5; x += 0.5) {
      for (let z = -2.5; z <= 2.5; z += 0.5) {
        if (this.addPoint(cx + x, ceilY, cz + z, 20)) added++;
      }
    }

    this.framesSampled += 1;
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
    const step = 10;

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
        if (world && this.addPoint(world.x, world.y, world.z, 35)) added++;
      }
    }
    return added;
  }

  markGpuDepth(): void {
    if (this.depthMode === "none") this.depthMode = "gpu";
  }

  sampleCameraFallback(camera: THREE.PerspectiveCamera): number {
    return this.sampleRoomVolume(camera);
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
