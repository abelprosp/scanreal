"use client";

import { useEffect, useState } from "react";
import {
  depthSupportLabel,
  detectXRCapabilities,
  type XRCapabilities,
} from "@/lib/xr/capabilities";

export function DeviceSupportBadge() {
  const [caps, setCaps] = useState<XRCapabilities | null>(null);

  useEffect(() => {
    detectXRCapabilities().then(setCaps);
  }, []);

  if (!caps) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
        Verificando suporte WebXR…
      </div>
    );
  }

  const ok = caps.immersiveAr && caps.isSecureContext;
  const label = depthSupportLabel(caps);

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        ok
          ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-100"
          : "border-amber-900/60 bg-amber-950/40 text-amber-100"
      }`}
    >
      <p className="font-medium">{label}</p>
      <ul className="mt-2 space-y-1 text-xs opacity-80">
        <li>WebXR: {caps.webxr ? "sim" : "não"}</li>
        <li>AR imersivo: {caps.immersiveAr ? "sim" : "não"}</li>
        <li>Contexto seguro (HTTPS): {caps.isSecureContext ? "sim" : "não"}</li>
        <li>Dispositivo móvel detectado: {caps.isMobile ? "sim" : "não"}</li>
      </ul>
      <p className="mt-2 text-xs opacity-70">
        A profundidade varia por aparelho e navegador (Chrome Android costuma ser o melhor suporte).
      </p>
    </div>
  );
}
