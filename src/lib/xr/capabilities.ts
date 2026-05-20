import { isIOSDevice } from "@/lib/xr/device";

export interface XRCapabilities {
  webxr: boolean;
  immersiveAr: boolean;
  depthSensing: boolean;
  userAgent: string;
  isSecureContext: boolean;
  isMobile: boolean;
  isIOS: boolean;
  /** Modo que funciona em qualquer celular moderno */
  universalCamera: boolean;
}

export async function detectXRCapabilities(): Promise<XRCapabilities> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const xr = nav?.xr;
  const ua = nav?.userAgent ?? "";
  const isIOS = isIOSDevice();

  let immersiveAr = false;
  let depthSensing = false;

  if (xr && typeof xr.isSessionSupported === "function" && !isIOS) {
    try {
      immersiveAr = await xr.isSessionSupported("immersive-ar");
    } catch {
      immersiveAr = false;
    }
  }

  if (immersiveAr) {
    depthSensing = true;
  }

  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (nav?.maxTouchPoints ?? 0) > 1;

  const universalCamera = Boolean(
    nav?.mediaDevices?.getUserMedia &&
      (typeof window !== "undefined" ? window.isSecureContext : false)
  );

  return {
    webxr: Boolean(xr) && !isIOS,
    immersiveAr,
    depthSensing,
    userAgent: ua,
    isSecureContext:
      typeof window !== "undefined" ? window.isSecureContext : false,
    isMobile,
    isIOS,
    universalCamera,
  };
}

export function depthSupportLabel(caps: XRCapabilities): string {
  if (!caps.isSecureContext) {
    return "Abra pelo link HTTPS (.vercel.app) para usar a câmera";
  }
  if (caps.universalCamera) {
    if (caps.isIOS) {
      return "iPhone compatível — câmera + movimento do aparelho";
    }
    if (caps.immersiveAr) {
      return "Android compatível — câmera universal + AR avançado opcional";
    }
    return "Celular compatível — câmera + sensores de movimento";
  }
  return "Permita câmera e sensores quando o navegador solicitar";
}
