"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectXRCapabilities,
  type XRCapabilities,
} from "@/lib/xr/capabilities";
import {
  startCameraPreview,
  stopCameraPreview,
} from "@/lib/xr/camera-fallback";
import {
  getDepthMapperApi,
  registerDepthMapper,
  type ScanStatus,
} from "@/lib/xr/register-depth-mapper";
import type { DepthMode, EnvironmentKind, ScanStats } from "@/lib/types/environment";
import { computeBounds, saveEnvironment } from "@/lib/storage/environments";

type DepthScannerProps = {
  name: string;
  kind: EnvironmentKind;
  description?: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function DepthScanner({
  name,
  kind,
  description,
  onSaved,
  onCancel,
}: DepthScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<HTMLElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [caps, setCaps] = useState<XRCapabilities | null>(null);
  const [mode, setMode] = useState<"webxr" | "camera2d">("webxr");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<ScanStats>({
    pointCount: 0,
    depthMode: "none",
    depthSupported: false,
    framesSampled: 0,
  });
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [arActive, setArActive] = useState(false);

  useEffect(() => {
    detectXRCapabilities().then((c) => {
      setCaps(c);
      if (!c.immersiveAr) setMode("camera2d");
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ status: ScanStatus; message?: string }>)
        .detail;
      if (detail?.status) {
        setStatus(detail.status);
        setArActive(detail.status === "scanning" || detail.status === "starting");
      }
      if (detail?.message) setMessage(detail.message);
    };
    const onStatsEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ stats: ScanStats }>).detail;
      if (detail?.stats) setStats(detail.stats);
    };

    async function init() {
      await import("aframe");
      registerDepthMapper();

      if (!mounted || !containerRef.current) return;

      const scene = document.createElement("a-scene");
      scene.setAttribute(
        "webxr",
        "referenceSpaceType: local; requiredFeatures: ; optionalFeatures: local, local-floor, hit-test, depth-sensing, dom-overlay, camera-access"
      );
      scene.setAttribute(
        "renderer",
        "alpha: true; antialias: true; colorManagement: true"
      );
      scene.setAttribute("vr-mode-ui", "enabled: false");
      scene.setAttribute("device-orientation-permission-ui", "enabled: false");
      scene.setAttribute("depth-mapper", "useAFrameAR: true");
      scene.setAttribute(
        "style",
        "width: 100%; height: 100%; position: absolute; inset: 0;"
      );

      scene.innerHTML = `
        <a-entity id="rig" position="0 1.6 0">
          <a-camera look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
        </a-entity>
      `;

      containerRef.current.appendChild(scene);
      sceneRef.current = scene;

      scene.addEventListener("depth-mapper-status", onStatus as EventListener);
      scene.addEventListener("depth-mapper-stats", onStatsEvent as EventListener);

      scene.addEventListener("loaded", () => {
        if (!mounted) return;
        const webxr = (scene as unknown as { systems?: { webxr?: { sessionConfiguration?: XRSessionInit } } }).systems?.webxr;
        if (webxr?.sessionConfiguration) {
          webxr.sessionConfiguration.depthSensing = {
            usagePreference: ["cpu-optimized", "gpu-optimized"],
            dataFormatPreference: ["luminance-alpha", "float32"],
          };
        }
        setReady(true);
      });
    }

    if (mode === "webxr") {
      init();
    } else {
      setReady(true);
    }

    return () => {
      mounted = false;
      stopCameraPreview(streamRef.current);
      streamRef.current = null;

      const api = getDepthMapperApi(sceneRef.current);
      api?.stopScan();

      const scene = sceneRef.current;
      if (scene) {
        scene.removeEventListener("depth-mapper-status", onStatus as EventListener);
        scene.removeEventListener("depth-mapper-stats", onStatsEvent as EventListener);
        scene.parentNode?.removeChild(scene);
      }
      sceneRef.current = null;
    };
  }, [mode]);

  const startScan = useCallback(async () => {
    setMessage("");

    if (mode === "camera2d" && videoRef.current) {
      try {
        setStatus("starting");
        streamRef.current = await startCameraPreview(videoRef.current);
        setStatus("scanning");
        setArActive(true);
        setMessage(
          "Modo câmera 2D (sem WebXR AR). Para AR completo, use Chrome no Android."
        );
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Erro na câmera");
      }
      return;
    }

    const api = getDepthMapperApi(sceneRef.current);
    if (!api) {
      setMessage("Cena AR ainda não carregou. Aguarde e tente de novo.");
      return;
    }

    try {
      await api.startScan();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao iniciar AR");
    }
  }, [mode]);

  const stopScan = useCallback(() => {
    if (mode === "camera2d") {
      stopCameraPreview(streamRef.current);
      streamRef.current = null;
      setStatus("stopped");
      setArActive(false);
      return;
    }
    getDepthMapperApi(sceneRef.current)?.stopScan();
    setArActive(false);
  }, [mode]);

  const handleSave = useCallback(async () => {
    const api = getDepthMapperApi(sceneRef.current);
    if (!api && mode === "webxr") return;

    setSaving(true);
    try {
      const points =
        mode === "webxr" && api
          ? api.getPoints()
          : new Float32Array(0);
      const depthMode: DepthMode =
        mode === "webxr" && api ? api.getDepthMode() : "none";

      if (points.length < 300 && mode === "webxr") {
        setMessage("Poucos pontos capturados. Escaneie mais o ambiente antes de salvar.");
        return;
      }

      const record = await saveEnvironment({
        name,
        kind,
        description,
        depthMode,
        pointCount: Math.max(points.length / 3, mode === "camera2d" ? 1 : 0),
        points: points.length >= 300 ? points : new Float32Array([0, 0, 0]),
        bounds: computeBounds(points.length >= 300 ? points : new Float32Array([0, 0, 0])),
      });
      onSaved(record.id);
    } finally {
      setSaving(false);
    }
  }, [name, kind, description, onSaved, mode]);

  const depthLabel =
    stats.depthMode === "cpu"
      ? "CPU Depth"
      : stats.depthMode === "gpu"
        ? "GPU Depth"
        : mode === "camera2d"
          ? "Câmera 2D"
          : "Estimativa";

  const isIOS =
    caps?.userAgent &&
    /iPhone|iPad|iPod/i.test(caps.userAgent) &&
    !/CriOS|FxiOS|Chrome/i.test(caps.userAgent);

  return (
    <div className="relative flex h-full min-h-[70dvh] flex-col">
      <div
        className={`relative min-h-[55dvh] flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-black ${
          arActive ? "fixed inset-0 z-40 min-h-screen rounded-none border-0" : ""
        }`}
      >
        {mode === "camera2d" && (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />
        )}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${mode === "camera2d" ? "hidden" : ""}`}
        />
      </div>

      <div
        id="ar-dom-overlay"
        className={`mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-4 text-sm ${
          arActive ? "fixed bottom-0 left-0 right-0 z-50 m-0 rounded-t-2xl border-x-0 border-b-0" : ""
        }`}
      >
        {caps && !caps.immersiveAr && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/50 px-3 py-2 text-xs text-amber-100">
            {isIOS ? (
              <>
                <strong>iPhone:</strong> Safari tem WebXR AR muito limitado. O app
                usa câmera 2D como alternativa. Para AR completo, teste em{" "}
                <strong>Android + Chrome</strong>.
              </>
            ) : (
              <>
                Seu navegador não suporta <code>immersive-ar</code>. Use{" "}
                <strong>Chrome atualizado no Android</strong> e abra o link HTTPS da Vercel.
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-zinc-100">Scanner AR</span>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            {depthLabel}
          </span>
        </div>

        <p className="text-zinc-400">
          {message ||
            (mode === "webxr"
              ? "Toque em Iniciar e permita câmera + motion sensors quando o Chrome pedir."
              : "Permita o acesso à câmera quando solicitado.")}
        </p>

        {status === "error" && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-200/90">
            <li>Abra o site em HTTPS (link .vercel.app)</li>
            <li>Use Chrome no Android (não navegador dentro do Instagram)</li>
            <li>Conceda permissão de câmera ao site</li>
            <li>Evite aba anônima na primeira vez</li>
          </ul>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-emerald-400">{stats.pointCount}</div>
            <div className="text-zinc-500">pontos</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-sky-400">{stats.framesSampled}</div>
            <div className="text-zinc-500">frames</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-amber-400">
              {stats.depthSupported ? "sim" : "não"}
            </div>
            <div className="text-zinc-500">depth API</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status !== "scanning" && status !== "starting" ? (
            <button
              type="button"
              disabled={!ready}
              onClick={startScan}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Iniciar câmera AR
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScan}
              className="rounded-xl bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500"
            >
              Parar captura
            </button>
          )}

          <button
            type="button"
            disabled={(mode === "webxr" && stats.pointCount < 100) || saving}
            onClick={handleSave}
            className="rounded-xl bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {saving ? "Salvando…" : "Salvar mapa"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-700 px-4 py-2.5 text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Status: {status}
          {caps?.immersiveAr ? " · WebXR AR disponível" : " · modo câmera 2D"}
        </p>
      </div>
    </div>
  );
}
