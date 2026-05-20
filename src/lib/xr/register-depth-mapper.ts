// @ts-nocheck — componente A-Frame com contexto `this` dinâmico
import AFRAME from "aframe";
import * as THREE from "three";
import { DepthPointAccumulator } from "@/lib/xr/depth-sampler";
import { requestARSessionWithDepth } from "@/lib/xr/request-ar-session";
import type { DepthMode, ScanStats } from "@/lib/types/environment";

const COMPONENT = "depth-mapper";

let registered = false;

export type ScanStatus = "idle" | "starting" | "scanning" | "stopped" | "error";

export interface DepthMapperAPI {
  startScan: () => Promise<void>;
  stopScan: () => void;
  getStats: () => ScanStats;
  getPoints: () => Float32Array;
  getDepthMode: () => DepthMode;
  onStatus?: (status: ScanStatus, message?: string) => void;
  onStats?: (stats: ScanStats) => void;
}

export function registerDepthMapper(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;

  // Componente A-Frame usa `this` dinâmico — tipagem relaxada
  AFRAME.registerComponent(COMPONENT, {
    schema: {
      active: { type: "boolean", default: false },
    },

    init() {
      this.accumulator = new DepthPointAccumulator();
      this.status = "idle";
      this.depthUsage = null;
      this.depthEnabled = false;
      this.session = null;
      this.onStatus = undefined;
      this.onStats = undefined;

      const api: DepthMapperAPI = {
        startScan: () => this.startScan(),
        stopScan: () => this.stopScan(),
        getStats: () => this.buildStats(),
        getPoints: () => this.accumulator.toFloat32Array(),
        getDepthMode: () => this.accumulator.depthMode,
      };

      (this.el as HTMLElement & { depthMapperApi?: DepthMapperAPI }).depthMapperApi =
        api;

      this._onRender = this.onRender.bind(this);
      this.el.addEventListener("render", this._onRender);
    },

    async startScan() {
      const sceneEl = this.el;
      const renderer = sceneEl.renderer as THREE.WebGLRenderer & {
        xr: THREE.WebXRManager;
      };

      this.setStatus("starting");

      try {
        const { session, depthEnabled, depthUsage } =
          await requestARSessionWithDepth();

        this.session = session;
        this.depthEnabled = depthEnabled;
        this.depthUsage = depthUsage;
        this.accumulator.reset();

        await renderer.xr.setSession(session);

        session.addEventListener("end", () => {
          this.setStatus("stopped");
        });

        this.setStatus("scanning", depthEnabled ? "Depth API ativa" : "AR sem profundidade");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Falha ao iniciar sessão AR";
        this.setStatus("error", msg);
        throw err;
      }
    },

    stopScan() {
      const renderer = this.el.renderer as THREE.WebGLRenderer;
      const session = renderer.xr.getSession();
      session?.end();
      this.setStatus("stopped");
    },

    onRender() {
      if (this.status !== "scanning") return;

      const renderer = this.el.renderer as THREE.WebGLRenderer & {
        xr: THREE.WebXRManager;
      };
      const frame = renderer.xr.getFrame();
      const refSpace = renderer.xr.getReferenceSpace();
      const camEntity = this.el.sceneEl?.camera;
      const camera = camEntity?.getObject3D?.("camera") as
        | THREE.PerspectiveCamera
        | undefined;
      if (!camera) {
        this.emitStats();
        return;
      }

      if (!frame || !refSpace || !camera) {
        if (this.status === "scanning") {
          this.accumulator.sampleCameraFallback(camera);
        }
        this.emitStats();
        return;
      }

      if (this.depthEnabled && this.depthUsage === "cpu-optimized") {
        this.accumulator.sampleFromFrame(
          frame,
          refSpace,
          camera,
          this.depthUsage
        );
      } else if (
        this.depthEnabled &&
        this.depthUsage === "gpu-optimized" &&
        renderer.xr.hasDepthSensing?.()
      ) {
        this.accumulator.markGpuDepth();
      } else {
        this.accumulator.sampleCameraFallback(camera);
      }

      this.emitStats();
    },

    buildStats(): ScanStats {
      return {
        pointCount: this.accumulator.pointCount,
        depthMode: this.accumulator.depthMode,
        depthSupported: this.depthEnabled,
        framesSampled: this.accumulator.frames,
      };
    },

    emitStats() {
      const stats = this.buildStats();
      this.onStats?.(stats);
      this.el.emit("depth-mapper-stats", { stats });
    },

    setStatus(status: ScanStatus, message?: string) {
      this.status = status;
      this.onStatus?.(status, message);
      this.el.emit("depth-mapper-status", { status, message });
    },

    remove() {
      this.stopScan();
      if (this._onRender) {
        this.el.removeEventListener("render", this._onRender);
      }
    },
  } as Record<string, unknown>);
}

export function getDepthMapperApi(
  sceneEl: HTMLElement | null
): DepthMapperAPI | null {
  if (!sceneEl) return null;
  const mapper = sceneEl.querySelector("[depth-mapper]");
  return (
    (mapper as HTMLElement & { depthMapperApi?: DepthMapperAPI })
      ?.depthMapperApi ?? null
  );
}
