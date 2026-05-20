import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  EMPTY_BOUNDS,
  type MappedEnvironment,
  type PointCloudBounds,
} from "@/lib/types/environment";

interface ScanDB extends DBSchema {
  environments: {
    key: string;
    value: MappedEnvironment;
  };
}

const DB_NAME = "ambient-scan-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ScanDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ScanDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("environments")) {
          db.createObjectStore("environments", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export function computeBounds(points: Float32Array): PointCloudBounds {
  if (points.length < 3) return { ...EMPTY_BOUNDS };

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    const z = points[i + 2];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}

export async function listEnvironments(): Promise<MappedEnvironment[]> {
  const db = await getDb();
  const all = await db.getAll("environments");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getEnvironment(
  id: string
): Promise<MappedEnvironment | undefined> {
  const db = await getDb();
  return db.get("environments", id);
}

export async function saveEnvironment(
  input: Omit<MappedEnvironment, "id" | "createdAt" | "updatedAt" | "bounds"> & {
    id?: string;
    bounds?: PointCloudBounds;
  }
): Promise<MappedEnvironment> {
  const db = await getDb();
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  const existing = await db.get("environments", id);
  const bounds =
    input.bounds ?? computeBounds(input.points);

  const record: MappedEnvironment = {
    id,
    name: input.name,
    kind: input.kind,
    description: input.description,
    depthMode: input.depthMode,
    pointCount: input.pointCount,
    points: input.points,
    bounds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.put("environments", record);
  return record;
}

export async function deleteEnvironment(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("environments", id);
}
