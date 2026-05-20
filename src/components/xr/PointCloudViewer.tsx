"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { boundsSpan } from "@/lib/scan/quality";
import { colorsFromPositions } from "@/lib/xr/point-colors";
import type { FloorPlanGrid, MappedEnvironment } from "@/lib/types/environment";
import { ScanQualityBar } from "@/components/ScanQualityBar";

type ViewMode = "3d" | "planta" | "frente" | "lateral";

type PointCloudViewerProps = {
  environment: MappedEnvironment;
};

function FloorPlanCanvas({ plan }: { plan: FloorPlanGrid }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);

    const cellW = w / plan.cols;
    const cellH = h / plan.rows;

    for (let row = 0; row < plan.rows; row++) {
      for (let col = 0; col < plan.cols; col++) {
        const v = plan.cells[row * plan.cols + col];
        if (v < 0.05) continue;
        const g = Math.floor(80 + v * 175);
        ctx.fillStyle = `rgb(30, ${g}, ${Math.floor(100 + v * 80)})`;
        ctx.fillRect(col * cellW, row * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    ctx.strokeStyle = "#334155";
    ctx.strokeRect(0, 0, w, h);
  }, [plan]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      aria-label="Planta baixa do ambiente"
    />
  );
}

function ThreeView({
  environment,
  mode,
}: {
  environment: MappedEnvironment;
  mode: ViewMode;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.FogExp2(0x0a0a0f, mode === "3d" ? 0.035 : 0.02);

    const center = new THREE.Vector3(
      (environment.bounds.min[0] + environment.bounds.max[0]) / 2,
      (environment.bounds.min[1] + environment.bounds.max[1]) / 2,
      (environment.bounds.min[2] + environment.bounds.max[2]) / 2
    );

    const span = boundsSpan(environment.bounds);
    const maxSpan = Math.max(span.x, span.y, span.z, 1.5);

    let camera: THREE.Camera;
    if (mode === "planta") {
      const ortho = new THREE.OrthographicCamera(
        -maxSpan,
        maxSpan,
        maxSpan * (height / width),
        -maxSpan * (height / width),
        0.1,
        100
      );
      ortho.position.set(center.x, center.y + maxSpan * 2.5, center.z);
      ortho.lookAt(center);
      camera = ortho;
    } else if (mode === "frente") {
      const ortho = new THREE.OrthographicCamera(
        -maxSpan,
        maxSpan,
        maxSpan,
        -maxSpan,
        0.1,
        100
      );
      ortho.position.set(center.x, center.y, center.z + maxSpan * 2);
      ortho.lookAt(center);
      camera = ortho;
    } else if (mode === "lateral") {
      const ortho = new THREE.OrthographicCamera(
        -maxSpan,
        maxSpan,
        maxSpan,
        -maxSpan,
        0.1,
        100
      );
      ortho.position.set(center.x + maxSpan * 2, center.y, center.z);
      ortho.lookAt(center);
      camera = ortho;
    } else {
      const persp = new THREE.PerspectiveCamera(55, width / height, 0.05, 120);
      persp.position.set(
        center.x + maxSpan * 1.6,
        center.y + maxSpan * 0.5,
        center.z + maxSpan * 1.6
      );
      persp.lookAt(center);
      camera = persp;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(environment.points, 3)
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colorsFromPositions(environment.points), 3)
    );

    const n = environment.pointCount;
    const material = new THREE.PointsMaterial({
      size: mode === "3d" ? (n > 5000 ? 0.03 : 0.045) : 0.025,
      vertexColors: true,
      sizeAttenuation: mode === "3d",
      opacity: 0.95,
      transparent: true,
    });

    scene.add(new THREE.Points(geometry, material));

    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as THREE.BufferAttribute
    );
    scene.add(new THREE.Box3Helper(box, 0x64748b));

    const grid = new THREE.GridHelper(maxSpan * 2, 20, 0x334155, 0x1e293b);
    grid.position.y = environment.bounds.min[1];
    if (mode === "3d") scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.65);
    dir.position.set(4, 8, 2);
    scene.add(dir);

    let yaw = 0.5;
    let pitch = 0.3;
    let radius = maxSpan * 2;
    let dragging = false;
    let lx = 0;
    let ly = 0;

    const updateOrbit = () => {
      if (mode !== "3d" || !(camera instanceof THREE.PerspectiveCamera)) return;
      camera.position.x = center.x + radius * Math.sin(yaw) * Math.cos(pitch);
      camera.position.y = center.y + radius * Math.sin(pitch);
      camera.position.z = center.z + radius * Math.cos(yaw) * Math.cos(pitch);
      camera.lookAt(center);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || mode !== "3d") return;
      yaw -= (e.clientX - lx) * 0.006;
      pitch = Math.max(0.05, Math.min(1.2, pitch - (e.clientY - ly) * 0.006));
      lx = e.clientX;
      ly = e.clientY;
      updateOrbit();
    };
    const onWheel = (e: WheelEvent) => {
      if (mode !== "3d") return;
      e.preventDefault();
      radius = Math.max(maxSpan * 0.5, Math.min(maxSpan * 5, radius + e.deltaY * 0.01));
      updateOrbit();
    };

    mount.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    mount.addEventListener("wheel", onWheel, { passive: false });

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (mode === "3d" && !dragging) yaw += 0.003;
      updateOrbit();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 400;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      mount.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      mount.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [environment, mode]);

  return (
    <div
      ref={mountRef}
      className="h-[52dvh] min-h-[280px] w-full touch-none"
    />
  );
}

export function PointCloudViewer({ environment }: PointCloudViewerProps) {
  const [mode, setMode] = useState<ViewMode>("3d");
  const span = boundsSpan(environment.bounds);
  const q = environment.quality;

  const tabs: { id: ViewMode; label: string }[] = [
    { id: "3d", label: "3D completo" },
    { id: "planta", label: "Planta" },
    { id: "frente", label: "Frente" },
    { id: "lateral", label: "Lateral" },
  ];

  return (
    <div className="space-y-4">
      {q && <ScanQualityBar quality={q} />}

      <div className="flex flex-wrap gap-1 rounded-xl bg-zinc-900 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
              mode === t.id
                ? "bg-emerald-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        {mode === "planta" && environment.floorPlan ? (
          <div className="h-[52dvh] min-h-[280px]">
            <FloorPlanCanvas plan={environment.floorPlan} />
          </div>
        ) : (
          <ThreeView environment={environment} mode={mode} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 sm:grid-cols-4">
        <div>
          <span className="text-zinc-400">Largura</span>
          <p className="font-medium text-zinc-200">{span.x.toFixed(1)} m</p>
        </div>
        <div>
          <span className="text-zinc-400">Altura</span>
          <p className="font-medium text-zinc-200">{span.y.toFixed(1)} m</p>
        </div>
        <div>
          <span className="text-zinc-400">Profundidade</span>
          <p className="font-medium text-zinc-200">{span.z.toFixed(1)} m</p>
        </div>
        <div>
          <span className="text-zinc-400">Pontos</span>
          <p className="font-medium text-zinc-200">
            {environment.pointCount.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Verde = chão · Azul = paredes · Roxo = alto. Use todas as vistas antes de enviar à IA.
        {mode === "3d" && " Arraste para girar, scroll para zoom."}
      </p>
    </div>
  );
}
