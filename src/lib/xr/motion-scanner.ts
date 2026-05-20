import * as THREE from "three";
import { DepthPointAccumulator } from "@/lib/xr/depth-sampler";
import type { DepthMode, ScanStats } from "@/lib/types/environment";

/**
 * Mapeamento 3D universal: câmera + orientação do celular.
 * Funciona em iPhone (Safari/Chrome), Android, etc. — sem WebXR.
 */
export class MotionScanner {
  private readonly accumulator = new DepthPointAccumulator();
  private readonly euler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3(0, 1.45, 0);
  private readonly velocity = new THREE.Vector3();
  private readonly virtualCamera = new THREE.PerspectiveCamera(70, 9 / 16, 0.05, 50);

  private lastMotionTime = 0;
  private hasOrientation = false;

  orientation = { alpha: 0, beta: 90, gamma: 0 };

  reset(): void {
    this.accumulator.reset();
    this.position.set(0, 1.45, 0);
    this.velocity.set(0, 0, 0);
    this.hasOrientation = false;
    this.lastMotionTime = 0;
  }

  setOrientation(
    alpha: number | null,
    beta: number | null,
    gamma: number | null
  ): void {
    if (alpha === null || beta === null) return;

    this.hasOrientation = true;
    this.orientation = {
      alpha,
      beta,
      gamma: gamma ?? 0,
    };

    this.euler.set(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(-(gamma ?? 0)),
      "YXZ"
    );
    this.quaternion.setFromEuler(this.euler);
  }

  setMotion(acceleration: { x: number; y: number; z: number } | null): void {
    if (!acceleration) return;

    const now = performance.now();
    const dt =
      this.lastMotionTime > 0
        ? Math.min((now - this.lastMotionTime) / 1000, 0.12)
        : 0;
    this.lastMotionTime = now;

    if (dt <= 0) return;

    const ax = acceleration.x * 0.08;
    const ay = acceleration.y * 0.08;
    const az = acceleration.z * 0.08;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);

    this.velocity.addScaledVector(forward, -az * dt);
    this.velocity.addScaledVector(right, ax * dt);
    this.velocity.y += ay * dt * 0.5;

    this.velocity.multiplyScalar(0.92);
    this.position.addScaledVector(this.velocity, dt * 4);
  }

  tick(): void {
    this.virtualCamera.position.copy(this.position);
    this.virtualCamera.quaternion.copy(this.quaternion);
    this.virtualCamera.updateMatrixWorld(true);

    this.accumulator.sampleCameraFallback(this.virtualCamera);
    this.accumulator.depthMode = "motion";
  }

  getStats(): ScanStats {
    return {
      pointCount: this.accumulator.pointCount,
      depthMode: "motion" as DepthMode,
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
