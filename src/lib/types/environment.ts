export type EnvironmentKind = "casa" | "loja" | "ambiente";

/** cpu/gpu = WebXR Depth; motion = câmera + giroscópio; none = estimativa AR */
export type DepthMode = "cpu" | "gpu" | "motion" | "none";

export interface PointCloudBounds {
  min: [number, number, number];
  max: [number, number, number];
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
  /** Posições x,y,z intercaladas */
  points: Float32Array;
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
