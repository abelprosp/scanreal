export type EnvironmentKind = "casa" | "loja" | "ambiente";

/** cpu/gpu = WebXR Depth; motion = câmera + giroscópio; none = estimativa AR */
export type DepthMode = "cpu" | "gpu" | "motion" | "none";

export interface PointCloudBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ScanQuality {
  /** 0–100 — pronto para enviar à IA quando ≥ 65 */
  score: number;
  yawCoverage: number;
  floorAreaM2: number;
  heightM: number;
  volumeM3: number;
  pointDensity: number;
  readyForAI: boolean;
  issues: string[];
  tips: string[];
}

export interface FloorPlanGrid {
  cols: number;
  rows: number;
  cellSize: number;
  origin: [number, number];
  /** Ocupação 0–1 por célula, row-major */
  cells: number[];
}

export interface MappedEnvironment {
  id: string;
  name: string;
  kind: EnvironmentKind;
  description?: string;
  createdAt: number;
  updatedAt: number;
  depthMode: DepthMode;
  pointCount: number;
  bounds: PointCloudBounds;
  points: Float32Array;
  quality?: ScanQuality;
  floorPlan?: FloorPlanGrid;
}

export interface ScanStats {
  pointCount: number;
  depthMode: DepthMode;
  depthSupported: boolean;
  framesSampled: number;
}

export const EMPTY_BOUNDS: PointCloudBounds = {
  min: [0, 0, 0],
  max: [0, 0, 0],
};
