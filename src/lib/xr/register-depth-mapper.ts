// @ts-nocheck — componente A-Frame com contexto `this` dinâmico
import AFRAME from "aframe";
import * as THREE from "three";
import { DepthPointAccumulator } from "@/lib/xr/depth-sampler";
import {
  requestARSessionWithDepth,
  requestReferenceSpace,
} from "@/lib/xr/request-ar-session";
import { buildARSessionConfiguration } from "@/lib/xr/session-config";
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

function patchWebXRSystem(sceneEl) {
  const webxr = sceneEl.systems?.webxr;
  if (!webxr) return;

  webxr.sessionReferenceSpaceType = "local";
  webxr.sessionConfiguration = buildARSessionConfiguration();

  const overlay = document.getElementById("ar-dom-overlay");
  if (overlay && webxr.data) {
    const features = webxr.sessionConfiguration.optionalFeatures ?? [];
    if (!features.includes("dom-overlay")) {
      features.push("dom-overlay");
    }
    webxr.sessionConfiguration.optionalFeatures = features;
    webxr.sessionConfiguration.domOverlay = { root: overlay };
    overlay.classList.add("a-dom-overlay");
  }
}

export function registerDepthMapper(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;

  AFRAME.registerComponent(COMPONENT, {
    schema: {
      useAFrameAR: { type: "boolean", default: true },
    },

    init() {
      this.accumulator = new DepthPointAccumulator();
      this.status = "idle";
      this.depthUsage = null;
      this.depthEnabled = false;
      this.session = null;
      this.referenceSpaceType = "";

      const api = {
        startScan: () => this.startScan(),
        stopScan: () => this.stopScan(),
        getStats: () => this.buildStats(),
        getPoints: () => this.accumulator.toFloat32Array(),
        getDepthMode: () => this.accumulator.depthMode,
      };

      this.el.depthMapperApi = api;

      this._onRender = this.onRender.bind(this);
      this.el.addEventListener("render", this._onRender);
    },

    async startScan() {
      const sceneEl = this.el.sceneEl || this.el;
      const renderer = sceneEl.renderer;

      this.setStatus("starting", "Solicitando permissão da câmera AR…");
      this.accumulator.reset();

      patchWebXRSystem(sceneEl);

      try {
        if (this.data.useAFrameAR && typeof sceneEl.enterAR === "function") {
          renderer.xr.enabled = true;
          await sceneEl.enterAR();
          this.session = renderer.xr.getSession();
        } else {
          await this.startScanManual(sceneEl, renderer);
        }

        if (!this.session) {
          throw new Error("Sessão AR não iniciou. Tente Chrome no Android.");
        }

        this.depthEnabled =
          this.session.enabledFeatures?.includes("depth-sensing") ?? false;
        this.depthUsage = this.depthEnabled
          ? this.session.depthUsage ?? null
          : null;

        this.setStatus(
          "scanning",
          this.depthEnabled
            ? "Câmera AR ativa · Depth API ligada"
            : "Câmera AR ativa · sem Depth API neste aparelho"
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Falha ao iniciar sessão AR";
        this.setStatus("error", msg);
        throw err;
      }
    },

    async startScanManual(sceneEl, renderer) {
      const { session } = await requestARSessionWithDepth();

      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");

      const { space, type } = await requestReferenceSpace(session);
      this.referenceSpaceType = type;

      await renderer.xr.setSession(session);
      renderer.xr.setReferenceSpace(space);

      session.addEventListener("end", () => this.setStatus("stopped"));

      this.session = session;
    },

    stopScan() {
      const sceneEl = this.el.sceneEl || this.el;
      const renderer = sceneEl.renderer;
      const session = renderer?.xr?.getSession?.();

      if (session) {
        session.end();
      } else if (typeof sceneEl.exitVR === "function" && sceneEl.is("vr-mode")) {
        sceneEl.exitVR();
      }

      this.setStatus("stopped");
    },

    onRender() {
      if (this.status !== "scanning") return;

      const sceneEl = this.el.sceneEl || this.el;
      const renderer = sceneEl.renderer;
      const frame = renderer.xr.getFrame();
      const refSpace = renderer.xr.getReferenceSpace();
      const camEntity = sceneEl.camera;
      const camera = camEntity?.getObject3D?.("camera");

      if (!camera) {
        this.emitStats();
        return;
      }

      if (!frame || !refSpace) {
        this.accumulator.sampleCameraFallback(camera);
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

    buildStats() {
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

    setStatus(status, message) {
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

export function getDepthMapperApi(sceneEl) {
  if (!sceneEl) return null;
  if (sceneEl.depthMapperApi) return sceneEl.depthMapperApi;

  const mapper = sceneEl.querySelector("[depth-mapper]");
  return mapper?.depthMapperApi ?? null;
}
