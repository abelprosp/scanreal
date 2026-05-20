const DEPTH_SENSING: XRDepthStateInit = {
  usagePreference: ["cpu-optimized", "gpu-optimized"],
  dataFormatPreference: ["luminance-alpha", "float32"],
};

/** Config compatível com a maioria dos Android (Chrome) em AR */
export function buildARSessionConfiguration(): XRSessionInit {
  return {
    requiredFeatures: [],
    optionalFeatures: [
      "local",
      "local-floor",
      "hit-test",
      "anchors",
      "plane-detection",
      "camera-access",
      "depth-sensing",
      "dom-overlay",
    ],
    depthSensing: DEPTH_SENSING,
  };
}

export const AR_REFERENCE_SPACE_TYPES = [
  "local",
  "local-floor",
  "viewer",
] as const;

export type ARReferenceSpaceType = (typeof AR_REFERENCE_SPACE_TYPES)[number];
