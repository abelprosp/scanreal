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
import { requestMotionPermission } from "@/lib/xr/motion-permissions";
import { MotionScanner } from "@/lib/xr/motion-scanner";
import type { DepthMode, EnvironmentKind, ScanStats } from "@/lib/types/environment";
import { computeBounds, saveEnvironment } from "@/lib/storage/environments";

type ScanStatus = "idle" | "starting" | "scanning" | "stopped" | "error";

type DepthScannerProps = {
  name: string;
  kind: EnvironmentKind;
  description?: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

const MIN_POINTS_SAVE = 60;

export function DepthScanner({
  name,
  kind,
  description,
  onSaved,
  onCancel,
}: DepthScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<MotionScanner | null>(null);
  const rafRef = useRef<number>(0);

  const [caps, setCaps] = useState<XRCapabilities | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<ScanStats>({
    pointCount: 0,
    depthMode: "motion",
    depthSupported: false,
    framesSampled: 0,
  });
  const [saving, setSaving] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [hasSensors, setHasSensors] = useState(false);

  useEffect(() => {
    detectXRCapabilities().then(setCaps);
    scannerRef.current = new MotionScanner();
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCameraPreview(streamRef.current);
    };
  }, []);

  const onOrientation = useCallback((e: DeviceOrientationEvent) => {
    scannerRef.current?.setOrientation(e.alpha, e.beta, e.gamma);
  }, []);

  const onMotion = useCallback((e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    scannerRef.current?.setMotion({ x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 });
  }, []);

  const stopScan = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    window.removeEventListener("deviceorientation", onOrientation);
    window.removeEventListener("devicemotion", onMotion);
    stopCameraPreview(streamRef.current);
    streamRef.current = null;
    setStatus("stopped");
    setScanActive(false);
  }, [onOrientation, onMotion]);

  const startScan = useCallback(async () => {
    if (!videoRef.current) return;

    setMessage("");
    setStatus("starting");

    try {
      const motionOk = await requestMotionPermission();
      if (!motionOk) {
        setMessage(
          "Permita o acesso aos sensores de movimento (ou ative em Ajustes > Safari > Movimento e Orientação)."
        );
      }

      scannerRef.current?.reset();
      streamRef.current = await startCameraPreview(videoRef.current);

      window.addEventListener("deviceorientation", onOrientation);
      window.addEventListener("devicemotion", onMotion);

      setStatus("scanning");
      setScanActive(true);
      setMessage(
        "Mova o celular lentamente pela sala. Os pontos 3D são criados pela câmera e pelo giroscópio."
      );

      const loop = () => {
        const s = scannerRef.current;
        s?.tick();
        if (s) {
          setStats(s.getStats());
          if (s.hasSensorData) setHasSensors(true);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir a câmera. Permita o acesso nas configurações do navegador."
      );
      stopScan();
    }
  }, [onOrientation, onMotion, stopScan]);

  const handleSave = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    const points = scanner.getPoints();
    if (points.length / 3 < MIN_POINTS_SAVE) {
      setMessage(
        `Continue escaneando — mínimo ${MIN_POINTS_SAVE} pontos (agora: ${Math.floor(points.length / 3)}).`
      );
      return;
    }

    setSaving(true);
    try {
      const record = await saveEnvironment({
        name,
        kind,
        description,
        depthMode: "motion" as DepthMode,
        pointCount: points.length / 3,
        points,
        bounds: computeBounds(points),
      });
      stopScan();
      onSaved(record.id);
    } finally {
      setSaving(false);
    }
  }, [name, kind, description, onSaved, stopScan]);

  const depthLabel =
    stats.depthMode === "motion"
      ? "Câmera + movimento"
      : stats.depthMode === "cpu"
        ? "Depth CPU"
        : stats.depthMode === "gpu"
          ? "Depth GPU"
          : "Mapeamento";

  return (
    <div className="relative flex h-full min-h-[70dvh] flex-col">
      <div
        className={`relative min-h-[55dvh] flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-black ${
          scanActive ? "fixed inset-0 z-40 min-h-screen rounded-none border-0" : ""
        }`}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {scanActive && stats.pointCount > 0 && (
          <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-emerald-300 backdrop-blur">
            {stats.pointCount} pontos capturados
          </div>
        )}
      </div>

      <div
        id="ar-dom-overlay"
        className={`mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-4 text-sm ${
          scanActive
            ? "fixed bottom-0 left-0 right-0 z-50 m-0 rounded-t-2xl border-x-0 border-b-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : ""
        }`}
      >
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
          <strong>Compatível com iPhone e Android.</strong> Funciona no Chrome, Safari e
          Firefox — usa câmera e sensores do aparelho, sem precisar de WebXR.
          {caps?.immersiveAr && !caps.isIOS && (
            <span className="mt-1 block text-emerald-200/70">
              Seu Android também pode usar AR avançado em versões futuras.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-zinc-100">Scanner de ambiente</span>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            {depthLabel}
          </span>
        </div>

        <p className="text-zinc-400">
          {message ||
            "Toque em Iniciar câmera e permita acesso à câmera e aos sensores de movimento."}
        </p>

        {status === "error" && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-200/90">
            <li>Abra o link HTTPS da Vercel (não HTTP)</li>
            <li>Toque em Permitir quando pedir câmera e movimento</li>
            <li>No iPhone: Ajustes → Safari → Movimento e Orientação → Permitir</li>
            <li>Não use o navegador embutido do Instagram — abra no Chrome ou Safari</li>
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
              {hasSensors ? "sim" : "aguarde"}
            </div>
            <div className="text-zinc-500">sensores</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status !== "scanning" && status !== "starting" ? (
            <button
              type="button"
              onClick={startScan}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
            >
              Iniciar câmera
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
            disabled={stats.pointCount < MIN_POINTS_SAVE || saving}
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
          {caps?.isIOS ? " · iPhone (modo universal)" : caps?.isMobile ? " · celular" : ""}
        </p>
      </div>
    </div>
  );
}
