import type { FloorPlanGrid, PointCloudBounds } from "@/lib/types/environment";

const DEFAULT_CELL = 0.15;

/** Projeção planta baixa (XZ) para IA e visualização 2D */
export function buildFloorPlan(
  points: Float32Array,
  bounds: PointCloudBounds,
  cellSize = DEFAULT_CELL
): FloorPlanGrid {
  const minX = bounds.min[0];
  const minZ = bounds.min[2];
  const maxX = bounds.max[0];
  const maxZ = bounds.max[2];

  const cols = Math.max(8, Math.ceil((maxX - minX) / cellSize));
  const rows = Math.max(8, Math.ceil((maxZ - minZ) / cellSize));
  const cells = new Array<number>(cols * rows).fill(0);

  const floorY = bounds.min[1] + (bounds.max[1] - bounds.min[1]) * 0.35;

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    const z = points[i + 2];

    if (y > floorY + 1.8) continue;

    const col = Math.floor((x - minX) / cellSize);
    const row = Math.floor((z - minZ) / cellSize);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    cells[idx] = Math.min(1, cells[idx] + 0.08);
  }

  return {
    cols,
    rows,
    cellSize,
    origin: [minX, minZ],
    cells,
  };
}
