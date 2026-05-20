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
  const isIOS = /iPhone|iPad|iPod/i.test(caps.userAgent);

  if (!caps.isSecureContext) {
    return "Requer HTTPS (link .vercel.app) para WebXR e câmera";
  }
  if (!caps.webxr) {
    return isIOS
      ? "iPhone: use Safari 17+ ou teste Android+Chrome para AR completo"
      : "WebXR indisponível — abra no Chrome (Android), não no app do Instagram";
  }
  if (!caps.immersiveAr) {
    return isIOS
      ? "AR imersivo limitado no iPhone; scanner usa câmera 2D"
      : "AR imersivo não suportado — use Chrome Android atualizado";
  }
  if (!caps.depthSensing) {
    return "AR disponível; profundidade pode não funcionar neste aparelho";
  }
  return "AR + Depth API potencialmente disponíveis (Chrome Android)";
}
