import {
  AR_REFERENCE_SPACE_TYPES,
  buildARSessionConfiguration,
} from "@/lib/xr/session-config";

export interface ARSessionResult {
  session: XRSession;
  depthEnabled: boolean;
  depthUsage: XRDepthUsage | null;
  referenceSpaceType: string;
}

const SESSION_ATTEMPTS: XRSessionInit[] = [
  buildARSessionConfiguration(),
  {
    requiredFeatures: [],
    optionalFeatures: ["local", "hit-test", "camera-access", "dom-overlay"],
  },
  {
    optionalFeatures: ["local"],
  },
];

export async function requestReferenceSpace(
  session: XRSession
): Promise<{ space: XRReferenceSpace; type: string }> {
  for (const type of AR_REFERENCE_SPACE_TYPES) {
    try {
      const space = await session.requestReferenceSpace(type);
      return { space, type };
    } catch {
      continue;
    }
  }
  throw new Error("Não foi possível criar espaço de referência AR.");
}

export async function requestARSessionWithDepth(): Promise<ARSessionResult> {
  const xr = navigator.xr;
  if (!xr) {
    throw new Error(
      "WebXR indisponível. No iPhone use Safari 17+ (suporte limitado) ou um Android com Chrome."
    );
  }

  const supported = await xr.isSessionSupported("immersive-ar");
  if (!supported) {
    throw new Error(
      "AR (immersive-ar) não suportado neste navegador. Use Chrome no Android."
    );
  }

  let lastError: unknown = null;

  for (const init of SESSION_ATTEMPTS) {
    try {
      const session = await xr.requestSession("immersive-ar", init);
      const depthEnabled =
        session.enabledFeatures?.includes("depth-sensing") ?? false;

      return {
        session,
        depthEnabled,
        depthUsage: depthEnabled ? (session.depthUsage ?? null) : null,
        referenceSpaceType: "pending",
      };
    } catch (err) {
      lastError = err;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Falha ao abrir sessão AR: ${detail}`);
}
