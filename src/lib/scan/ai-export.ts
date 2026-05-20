import { buildFloorPlan } from "@/lib/scan/floor-plan";
import { boundsSpan } from "@/lib/scan/quality";
import type { MappedEnvironment } from "@/lib/types/environment";

export interface AIExportPayload {
  version: "1.0";
  exportedAt: string;
  environment: {
    id: string;
    name: string;
    kind: string;
    description?: string;
    depthMode: string;
    pointCount: number;
    bounds: MappedEnvironment["bounds"];
    spanMeters: { x: number; y: number; z: number };
    quality: MappedEnvironment["quality"];
  };
  /** [x,y,z, x,y,z, ...] — formato direto para modelos de IA */
  points: number[];
  floorPlan: MappedEnvironment["floorPlan"];
  aiHints: {
    task: string;
    coordinateSystem: string;
    units: string;
  };
}

export function buildAIExport(env: MappedEnvironment): AIExportPayload {
  const span = boundsSpan(env.bounds);
  const floorPlan =
    env.floorPlan ?? buildFloorPlan(env.points, env.bounds);

  const points: number[] = [];
  for (let i = 0; i < env.points.length; i++) {
    points.push(
      Math.round(env.points[i] * 1000) / 1000
    );
  }

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    environment: {
      id: env.id,
      name: env.name,
      kind: env.kind,
      description: env.description,
      depthMode: env.depthMode,
      pointCount: env.pointCount,
      bounds: env.bounds,
      spanMeters: span,
      quality: env.quality,
    },
    points,
    floorPlan,
    aiHints: {
      task: "Avaliar layout, dimensões e completude do ambiente escaneado (casa, loja ou sala).",
      coordinateSystem: "Y-up, XZ = planta horizontal, metros aproximados",
      units: "metros (estimados por sensores do celular)",
    },
  };
}

export function downloadAIExport(env: MappedEnvironment): void {
  const payload = buildAIExport(env);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scan-ia-${env.name.replace(/\s+/g, "-").toLowerCase()}-${env.id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
