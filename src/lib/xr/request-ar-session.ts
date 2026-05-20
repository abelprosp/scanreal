export interface ARSessionResult {
  session: XRSession;
  depthEnabled: boolean;
  depthUsage: XRDepthUsage | null;
}

const DEPTH_SENSING: XRDepthStateInit = {
  usagePreference: ["cpu-optimized", "gpu-optimized"],
  dataFormatPreference: ["luminance-alpha", "float32"],
};

export async function requestARSessionWithDepth(): Promise<ARSessionResult> {
  const xr = navigator.xr;
  if (!xr) {
    throw new Error("WebXR não está disponível neste navegador.");
  }

  const supported = await xr.isSessionSupported("immersive-ar");
  if (!supported) {
    throw new Error("Sessão immersive-ar não é suportada neste dispositivo.");
  }

  const baseInit: XRSessionInit = {
    requiredFeatures: ["local-floor"],
    optionalFeatures: ["hit-test", "anchors", "plane-detection"],
  };

  try {
    const session = await xr.requestSession("immersive-ar", {
      ...baseInit,
      optionalFeatures: [
        ...(baseInit.optionalFeatures ?? []),
        "depth-sensing",
      ],
      depthSensing: DEPTH_SENSING,
    });

    const depthEnabled =
      session.enabledFeatures?.includes("depth-sensing") ?? false;

    return {
      session,
      depthEnabled,
      depthUsage: depthEnabled ? (session.depthUsage ?? null) : null,
    };
  } catch {
    const session = await xr.requestSession("immersive-ar", baseInit);
    return { session, depthEnabled: false, depthUsage: null };
  }
}
