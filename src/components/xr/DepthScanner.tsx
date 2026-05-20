"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScanQualityBar } from "@/components/ScanQualityBar";
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
import type { DepthMode, EnvironmentKind, ScanQuality, ScanStats } from "@/lib/types/environment";
import { computeBounds, saveEnvironment } from "@/lib/storage/environments";

const LiveScanPreview = dynamic(
  () => import("@/components/xr/LiveScanPreview").then((m) => m.LiveScanPreview),
  { ssr: false }
);

type ScanStatus = "idle" | "starting" | "scanning" | "stopped" | "error";

const SCAN_STEPS = [
  "Aponte para uma parede à sua frente",
  "Gire 360° muito devagar (completo)",
  "Em cada parede: aponte para baixo (chão) e para cima (teto)",
  "Dê 4–6 passos e repita o giro nas novas posições",
];

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
  const [quality, setQuality] = useState<ScanQuality | null>(null);
  const [previewPoints, setPreviewPoints] = useState<Float32Array>(new Float32Array(0));
  const [coverage, setCoverage] = useState(0);
  const [stations, setStations] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [forceSave, setForceSave] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

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
    const a = e.acceleration ?? e.accelerationIncludingGravity;
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
    const s = scannerRef.current;
    if (s) setQuality(s.getQuality());
  }, [onOrientation, onMotion]);

  const startScan = useCallback(async () => {
    if (!videoRef.current) return;

    setMessage("");
    setStatus("starting");
    setForceSave(false);
    setStepIndex(0);

    try {
      await requestMotionPermission();
      scannerRef.current?.reset();
      streamRef.current = await startCameraPreview(videoRef.current);

      window.addEventListener("deviceorientation", onOrientation);
      window.addEventListener("devicemotion", onMotion);

      setStatus("scanning");
      setScanActive(true);
      setMessage(SCAN_STEPS[0]);

      let frame = 0;
      const loop = () => {
        const s = scannerRef.current;
        s?.tick();
        if (s) {
          setStats(s.getStats());
          setCoverage(s.getCoveragePercent());
          setStations(s.stations);
          frame += 1;
          if (frame % 6 === 0) {
            setPreviewPoints(s.getPoints());
            setQuality(s.getQuality());
          }
          const cov = s.getCoveragePercent();
          if (cov < 25) setStepIndex(0);
          else if (cov < 55) setStepIndex(1);
          else if (cov < 80) setStepIndex(2);
          else setStepIndex(3);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Permita câmera e sensores de movimento."
      );
      stopScan();
    }
  }, [onOrientation, onMotion, stopScan]);

  const handleSave = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    const points = scanner.getPoints();
    const q = scanner.getQuality();

    if (!q.readyForAI && !forceSave) {
      setQuality(q);
      setMessage("Qualidade insuficiente para IA. Continue escaneando ou marque salvar mesmo assim.");
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
        quality: q,
        yawCoverage: scanner.getCoveragePercent(),
      });
      stopScan();
      onSaved(record.id);
    } finally {
      setSaving(false);
    }
  }, [name, kind, description, onSaved, stopScan, forceSave]);

  return (
    <div className="relative flex h-full min-h-[70dvh] flex-col">
      <div
        className={`relative min-h-[50dvh] flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-black ${
          scanActive ? "fixed inset-0 z-40 min-h-[45vh] rounded-none border-0" : ""
        }`}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {scanActive && (
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-3">
            <p className="text-xs font-medium text-emerald-300">
              Passo {stepIndex + 1}/4: {SCAN_STEPS[stepIndex]}
            </p>
          </div>
        )}
        {scanActive && previewPoints.length > 30 && (
          <div className="absolute bottom-2 right-2 w-[42%] max-w-[180px]">
            <LiveScanPreview points={previewPoints} />
            <p className="mt-1 text-center text-[10px] text-zinc-400">Prévia 3D ao vivo</p>
          </div>
        )}
      </div>

      <div
        className={`mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-4 text-sm ${
          scanActive
            ? "fixed bottom-0 left-0 right-0 z-50 max-h-[55vh] overflow-y-auto rounded-t-2xl border-x-0 border-b-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-zinc-100">Escaneamento completo</span>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            para avaliação IA
          </span>
        </div>

        {quality && <ScanQualityBar quality={quality} />}

        <p className="text-zinc-400">
          {message || "Escaneie o ambiente inteiro — a IA precisa ver paredes, chão e volume."}
        </p>

        <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-500">
          {SCAN_STEPS.map((s, i) => (
            <li key={s} className={i === stepIndex && scanActive ? "text-emerald-400" : ""}>
              {s}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-emerald-400">
              {stats.pointCount.toLocaleString("pt-BR")}
            </div>
            <div className="text-zinc-500">pontos</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-sky-400">{coverage}%</div>
            <div className="text-zinc-500">giro</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-violet-400">{stations}</div>
            <div className="text-zinc-500">estações</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 p-2">
            <div className="text-lg font-semibold text-amber-400">
              {quality?.score ?? "—"}%
            </div>
            <div className="text-zinc-500">IA</div>
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
              Parar
            </button>
          )}

          <button
            type="button"
            disabled={stats.pointCount < 500 || saving}
            onClick={handleSave}
            className="rounded-xl bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {saving ? "Salvando…" : quality?.readyForAI ? "Salvar para IA" : "Salvar"}
          </button>

          <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-zinc-300">
            Cancelar
          </button>
        </div>

        {quality && !quality.readyForAI && stats.pointCount >= 500 && (
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={forceSave}
              onChange={(e) => setForceSave(e.target.checked)}
              className="rounded"
            />
            Salvar mesmo com qualidade baixa (não recomendado para IA)
          </label>
        )}
      </div>
    </div>
  );
}
