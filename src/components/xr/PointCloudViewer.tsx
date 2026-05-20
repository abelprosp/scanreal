"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { colorsFromPositions } from "@/lib/xr/point-colors";
import type { MappedEnvironment } from "@/lib/types/environment";

type PointCloudViewerProps = {
  environment: MappedEnvironment;
};

export function PointCloudViewer({ environment }: PointCloudViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.04);

    const center = new THREE.Vector3(
      (environment.bounds.min[0] + environment.bounds.max[0]) / 2,
      (environment.bounds.min[1] + environment.bounds.max[1]) / 2,
      (environment.bounds.min[2] + environment.bounds.max[2]) / 2
    );

    const sizeX = environment.bounds.max[0] - environment.bounds.min[0];
    const sizeY = environment.bounds.max[1] - environment.bounds.min[1];
    const sizeZ = environment.bounds.max[2] - environment.bounds.min[2];
    const span = Math.max(sizeX, sizeY, sizeZ, 1.5);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.05, 120);
    let yaw = 0.6;
    let pitch = 0.35;
    let radius = span * 1.8;

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

    const pointCount = environment.points.length / 3;
    const material = new THREE.PointsMaterial({
      size: pointCount > 3000 ? 0.035 : 0.055,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
    });

    scene.add(new THREE.Points(geometry, material));

    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as THREE.BufferAttribute
    );
    const boxHelper = new THREE.Box3Helper(box, 0x475569);
    scene.add(boxHelper);

    const grid = new THREE.GridHelper(span * 1.5, 16, 0x334155, 0x1e293b);
    grid.position.y = environment.bounds.min[1];
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 10, 3);
    scene.add(dir);

    const updateCamera = () => {
      camera.position.x = center.x + radius * Math.sin(yaw) * Math.cos(pitch);
      camera.position.y = center.y + radius * Math.sin(pitch) + sizeY * 0.15;
      camera.position.z = center.z + radius * Math.cos(yaw) * Math.cos(pitch);
      camera.lookAt(center);
    };

    updateCamera();

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let autoYaw = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lastX) * 0.006;
      pitch = Math.max(0.05, Math.min(1.3, pitch - (e.clientY - lastY) * 0.006));
      lastX = e.clientX;
      lastY = e.clientY;
      updateCamera();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(span * 0.4, Math.min(span * 4, radius + e.deltaY * 0.008));
      updateCamera();
    };

    mount.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("wheel", onWheel, { passive: false });

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!dragging) {
        autoYaw += 0.002;
        yaw += autoYaw * 0.02;
      }
      updateCamera();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      mount.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [environment]);

  const thinWall =
    environment.bounds.max[0] - environment.bounds.min[0] < 1.2 &&
    environment.bounds.max[2] - environment.bounds.min[2] < 1.2;

  return (
    <div className="space-y-2">
      {thinWall && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          Este mapa ficou estreito (só girou no lugar). Na próxima vez: gire{" "}
          <strong>360°</strong> e dê <strong>3–4 passos</strong> enquanto aponta para as paredes.
        </p>
      )}
      <div
        ref={mountRef}
        className="h-[60dvh] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black touch-none"
      />
      <p className="text-xs text-zinc-500">
        Verde = chão · Azul = paredes · Roxo = teto. Arraste para girar, pinça/scroll para zoom.
      </p>
    </div>
  );
}
