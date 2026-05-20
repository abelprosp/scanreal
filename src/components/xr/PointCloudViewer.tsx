"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
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

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 200);
    const center = new THREE.Vector3(
      (environment.bounds.min[0] + environment.bounds.max[0]) / 2,
      (environment.bounds.min[1] + environment.bounds.max[1]) / 2,
      (environment.bounds.min[2] + environment.bounds.max[2]) / 2
    );
    const span = Math.max(
      environment.bounds.max[0] - environment.bounds.min[0],
      environment.bounds.max[1] - environment.bounds.min[1],
      environment.bounds.max[2] - environment.bounds.min[2],
      2
    );

    camera.position.set(center.x, center.y + span * 0.4, center.z + span * 1.2);
    camera.lookAt(center);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(environment.points, 3)
    );

    const material = new THREE.PointsMaterial({
      size: 0.04,
      color: 0x34d399,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const grid = new THREE.GridHelper(span * 2, 20, 0x334155, 0x1e293b);
    grid.position.y = environment.bounds.min[1];
    scene.add(grid);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(4, 8, 2);
    scene.add(ambient, dir);

    let yaw = 0;
    let pitch = 0.2;
    let radius = span * 1.5;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const updateCamera = () => {
      camera.position.x = center.x + radius * Math.sin(yaw) * Math.cos(pitch);
      camera.position.y = center.y + radius * Math.sin(pitch);
      camera.position.z = center.z + radius * Math.cos(yaw) * Math.cos(pitch);
      camera.lookAt(center);
    };

    updateCamera();

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
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.005;
      pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.005));
      updateCamera();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(0.5, Math.min(50, radius + e.deltaY * 0.01));
      updateCamera();
    };

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());

    mount.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const speed = 0.04 * radius;
      if (keys.has("w")) {
        center.z -= speed;
      }
      if (keys.has("s")) {
        center.z += speed;
      }
      if (keys.has("a")) {
        center.x -= speed;
      }
      if (keys.has("d")) {
        center.x += speed;
      }
      if (keys.has("q")) {
        center.y -= speed;
      }
      if (keys.has("e")) {
        center.y += speed;
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [environment]);

  return (
    <div
      ref={mountRef}
      className="h-[60dvh] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black"
      tabIndex={0}
    />
  );
}
