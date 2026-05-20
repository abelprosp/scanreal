"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const sceneRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [stats, setStats] = useState<ScanStats>({
    pointCount: 0,
    depthMode: "none",
    depthSupported: false,
    framesSampled: 0,
  });
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ status: ScanStatus; message?: string }>)
        .detail;
      if (detail?.status) setStatus(detail.status);
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
      scene.setAttribute("embedded", "");
      scene.setAttribute("renderer", "colorManagement: true; physicallyCorrectLights: true");
      scene.setAttribute("vr-mode-ui", "enabled: false");
      scene.setAttribute("device-orientation-permission-ui", "enabled: false");
      scene.setAttribute("depth-mapper", "");
      scene.setAttribute(
        "style",
        "width: 100%; height: 100%; position: absolute; inset: 0;"
      );

      scene.innerHTML = `
        <a-entity id="rig" position="0 1.6 0">
          <a-camera look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
        </a-entity>
        <a-entity id="point-preview"></a-entity>
      `;

      containerRef.current.appendChild(scene);
      sceneRef.current = scene;

      scene.addEventListener("depth-mapper-status", onStatus as EventListener);
      scene.addEventListener("depth-mapper-stats", onStatsEvent as EventListener);

      scene.addEventListener("loaded", () => {
        if (mounted) setReady(true);
      });
    }

    init();

    return () => {
      mounted = false;
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
  }, []);

  const startScan = useCallback(async () => {
    const api = getDepthMapperApi(sceneRef.current);
    if (!api) return;
    try {
      await api.startScan();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao iniciar");
    }
  }, []);

  const stopScan = useCallback(() => {
    getDepthMapperApi(sceneRef.current)?.stopScan();
  }, []);

  const handleSave = useCallback(async () => {
    const api = getDepthMapperApi(sceneRef.current);
    if (!api) return;

    setSaving(true);
    try {
      const points = api.getPoints();
      const depthMode: DepthMode = api.getDepthMode();
      const record = await saveEnvironment({
        name,
        kind,
        description,
        depthMode,
        pointCount: points.length / 3,
        points,
        bounds: computeBounds(points),
      });
      onSaved(record.id);
    } finally {
      setSaving(false);
    }
  }, [name, kind, description, onSaved]);

  const depthLabel =
    stats.depthMode === "cpu"
      ? "CPU Depth"
      : stats.depthMode === "gpu"
        ? "GPU Depth"
        : "Estimativa (sem depth)";

  return (
    <div className="relative flex h-full min-h-[70dvh] flex-col">
      <div ref={containerRef} className="relative min-h-[55dvh] flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-black" />

      <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-zinc-100">Scanner AR</span>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            {depthLabel}
          </span>
        </div>

        <p className="text-zinc-400">
          {message || "Mova o celular lentamente pelo ambiente. O mapa acumula pontos 3D a cada frame."}
        </p>

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
          {status !== "scanning" ? (
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
            disabled={stats.pointCount < 100 || saving}
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
          Status: {status}. Em aparelhos sem Depth API, o sistema usa estimativa por câmera (menos preciso).
        </p>
      </div>
    </div>
  );
}
