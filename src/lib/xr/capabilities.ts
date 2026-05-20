export interface XRCapabilities {
  webxr: boolean;
  immersiveAr: boolean;
  depthSensing: boolean;
  userAgent: string;
  isSecureContext: boolean;
  isMobile: boolean;
}

export async function detectXRCapabilities(): Promise<XRCapabilities> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const xr = nav?.xr;
  const ua = nav?.userAgent ?? "";

  let immersiveAr = false;
  let depthSensing = false;

  if (xr && typeof xr.isSessionSupported === "function") {
    try {
      immersiveAr = await xr.isSessionSupported("immersive-ar");
    } catch {
      immersiveAr = false;
    }
  }

  if (immersiveAr && xr && "DepthInformation" in globalThis) {
    depthSensing = true;
  }

  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (nav?.maxTouchPoints ?? 0) > 1;

  return {
    webxr: Boolean(xr),
    immersiveAr,
    depthSensing,
    userAgent: ua,
    isSecureContext:
      typeof window !== "undefined" ? window.isSecureContext : false,
    isMobile,
  };
}

export function depthSupportLabel(caps: XRCapabilities): string {
  if (!caps.isSecureContext) {
    return "Requer HTTPS (ou localhost) para WebXR";
  }
  if (!caps.webxr) return "WebXR indisponível neste navegador";
  if (!caps.immersiveAr) return "AR imersivo não suportado";
  if (!caps.depthSensing) {
    return "AR disponível; profundidade pode não funcionar neste aparelho";
  }
  return "AR + Depth API potencialmente disponíveis";
}
