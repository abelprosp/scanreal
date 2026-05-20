"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { colorsFromPositions } from "@/lib/xr/point-colors";

type LiveScanPreviewProps = {
  points: Float32Array;
  className?: string;
};

/** Miniatura 3D ao vivo durante o escaneamento */
export function LiveScanPreview({ points, className }: LiveScanPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 160;
    const h = mount.clientHeight || 120;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 80);
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    mount.appendChild(renderer.domElement);

    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.PointsMaterial | null = null;
    let cloud: THREE.Points | null = null;

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      if (points.length >= 9) {
        if (!cloud) {
          geometry = new THREE.BufferGeometry();
          material = new THREE.PointsMaterial({
            size: 0.06,
            vertexColors: true,
            sizeAttenuation: true,
          });
          cloud = new THREE.Points(geometry, material);
          scene.add(cloud);
        }

        geometry!.setAttribute(
          "position",
          new THREE.BufferAttribute(points.slice(0), 3)
        );
        geometry!.setAttribute(
          "color",
          new THREE.BufferAttribute(colorsFromPositions(points), 3)
        );
        geometry!.computeBoundingSphere();

        const c = geometry!.boundingSphere?.center ?? new THREE.Vector3();
        camera.position.set(c.x + 3, c.y + 2, c.z + 3);
        camera.lookAt(c);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geometry?.dispose();
      material?.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [points]);

  return (
    <div
      ref={mountRef}
      className={className ?? "h-28 w-full rounded-lg border border-zinc-700 bg-black"}
    />
  );
}
