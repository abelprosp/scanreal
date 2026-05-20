import { computeBounds } from "@/lib/storage/environments";
import type { PointCloudBounds, ScanQuality } from "@/lib/types/environment";

export function analyzeScanQuality(
  points: Float32Array,
  yawCoverage: number
): ScanQuality {
  const issues: string[] = [];
  const tips: string[] = [];
  const n = points.length / 3;

  if (n < 500) {
    issues.push("Poucos pontos capturados");
    tips.push("Escaneie por mais 30–60 segundos");
  }

  if (yawCoverage < 50) {
    issues.push("Giro incompleto (menos de metade da volta)");
    tips.push("Gire 360° lentamente ao redor do corpo");
  }

  const bounds = computeBounds(points);
  const sx = bounds.max[0] - bounds.min[0];
  const sy = bounds.max[1] - bounds.min[1];
  const sz = bounds.max[2] - bounds.min[2];

  const floorAreaM2 = Math.max(sx * sz, 0.01);
  const heightM = Math.max(sy, 0.01);
  const volumeM3 = sx * sy * sz;
  const pointDensity = n / Math.max(volumeM3, 0.5);

  if (sx < 2 || sz < 2) {
    issues.push("Área horizontal muito pequena");
    tips.push("Dê passos para os lados enquanto aponta para cada parede");
  }

  if (heightM < 1.2) {
    issues.push("Altura do ambiente pouco capturada");
    tips.push("Aponte para cima (teto) e para baixo (chão) em cada parede");
  }

  let score = 0;
  score += Math.min(30, (n / 8000) * 30);
  score += Math.min(25, (yawCoverage / 100) * 25);
  score += Math.min(20, (Math.min(sx, sz) / 5) * 20);
  score += Math.min(15, (heightM / 2.5) * 15);
  score += Math.min(10, (pointDensity / 200) * 10);
  score = Math.round(Math.min(100, score));

  const readyForAI =
    score >= 65 &&
    n >= 3000 &&
    yawCoverage >= 55 &&
    sx >= 2 &&
    sz >= 2 &&
    heightM >= 1.2;

  if (!readyForAI && issues.length === 0) {
    tips.push("Continue escaneando até a barra de qualidade ficar verde");
  }

  return {
    score,
    yawCoverage,
    floorAreaM2: Math.round(floorAreaM2 * 10) / 10,
    heightM: Math.round(heightM * 100) / 100,
    volumeM3: Math.round(volumeM3 * 10) / 10,
    pointDensity: Math.round(pointDensity),
    readyForAI,
    issues,
    tips,
  };
}

export function boundsSpan(bounds: PointCloudBounds): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: bounds.max[0] - bounds.min[0],
    y: bounds.max[1] - bounds.min[1],
    z: bounds.max[2] - bounds.min[2],
  };
}
