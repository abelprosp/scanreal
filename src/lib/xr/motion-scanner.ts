import * as THREE from "three";
import { DepthPointAccumulator } from "@/lib/xr/depth-sampler";
import type { DepthMode, ScanStats } from "@/lib/types/environment";

function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Mapeamento universal: câmera + giroscópio + deslocamento.
 * Amostra em "estações" ao girar ou andar — preenche volume da sala.
 */
export class MotionScanner {
  private readonly accumulator = new DepthPointAccumulator();
  private readonly euler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3(0, 1.45, 0);
  private readonly lastSamplePos = new THREE.Vector3(0, 1.45, 0);
  private readonly velocity = new THREE.Vector3();
  private readonly virtualCamera = new THREE.PerspectiveCamera(70, 9 / 16, 0.05, 80);

  private lastMotionTime = 0;
  private lastAlpha = 0;
  private hasOrientation = false;
  private frameCount = 0;
  private coverageMinAlpha = 360;
  private coverageMaxAlpha = 0;

  orientation = { alpha: 0, beta: 90, gamma: 0 };

  reset(): void {
    this.accumulator.reset();
    this.position.set(0, 1.45, 0);
    this.lastSamplePos.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.hasOrientation = false;
    this.lastMotionTime = 0;
    this.lastAlpha = 0;
    this.frameCount = 0;
    this.coverageMinAlpha = 360;
    this.coverageMaxAlpha = 0;
  }

  setOrientation(
    alpha: number | null,
    beta: number | null,
    gamma: number | null
  ): void {
    if (alpha === null || beta === null) return;

    this.hasOrientation = true;
    this.orientation = { alpha, beta, gamma: gamma ?? 0 };

    this.coverageMinAlpha = Math.min(this.coverageMinAlpha, alpha);
    this.coverageMaxAlpha = Math.max(this.coverageMaxAlpha, alpha);

    this.euler.set(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(-(gamma ?? 0)),
      "YXZ"
    );
    this.quaternion.setFromEuler(this.euler);
  }

  /** Usa aceleração sem gravidade (melhor no iOS) */
  setMotion(acceleration: { x: number; y: number; z: number } | null): void {
    if (!acceleration) return;

    const now = performance.now();
    const dt =
      this.lastMotionTime > 0
        ? Math.min((now - this.lastMotionTime) / 1000, 0.1)
        : 0;
    this.lastMotionTime = now;
    if (dt <= 0) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);

    const scale = 0.35;
    this.velocity.addScaledVector(forward, -(acceleration.z ?? 0) * scale * dt);
    this.velocity.addScaledVector(right, (acceleration.x ?? 0) * scale * dt);
    this.velocity.y += (acceleration.y ?? 0) * scale * dt * 0.3;

    this.velocity.multiplyScalar(0.88);
    this.position.addScaledVector(this.velocity, dt * 6);
  }

  tick(): void {
    this.frameCount += 1;

    this.virtualCamera.position.copy(this.position);
    this.virtualCamera.quaternion.copy(this.quaternion);
    this.virtualCamera.updateMatrixWorld(true);

    const alpha = this.orientation.alpha;
    const rotated = angleDelta(alpha, this.lastAlpha) > 7;
    const moved = this.position.distanceTo(this.lastSamplePos) > 0.2;
    const periodic = this.frameCount % 12 === 0;

    if (rotated || moved || periodic) {
      this.accumulator.sampleRoomVolume(this.virtualCamera);
      this.accumulator.depthMode = "motion";
      this.lastAlpha = alpha;
      this.lastSamplePos.copy(this.position);
    }
  }

  /** 0–100: quanto o usuário já girou o celular (panorama) */
  getCoveragePercent(): number {
    if (!this.hasOrientation) return 0;
    let span = this.coverageMaxAlpha - this.coverageMinAlpha;
    if (span < 0) span += 360;
    return Math.min(100, Math.round((span / 180) * 100));
  }

  getStats(): ScanStats {
    return {
      pointCount: this.accumulator.pointCount,
      depthMode: "motion",
      depthSupported: false,
      framesSampled: this.accumulator.frames,
    };
  }

  getPoints(): Float32Array {
    return this.accumulator.toFloat32Array();
  }

  get hasSensorData(): boolean {
    return this.hasOrientation;
  }
}
