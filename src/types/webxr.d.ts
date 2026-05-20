interface XRDepthStateInit {
  usagePreference: XRDepthUsage[];
  dataFormatPreference: XRDepthDataFormat[];
}

type XRDepthUsage = "cpu-optimized" | "gpu-optimized";
type XRDepthDataFormat = "luminance-alpha" | "float32";

interface XRSession {
  readonly depthUsage: XRDepthUsage;
  readonly depthDataFormat: XRDepthDataFormat;
  readonly enabledFeatures?: string[];
}

interface XRSessionInit {
  depthSensing?: XRDepthStateInit;
}

interface XRFrame {
  getDepthInformation(view: XRView): XRCPUDepthInformation | null;
}

interface XRCPUDepthInformation {
  readonly width: number;
  readonly height: number;
  getDepthInMeters(x: number, y: number): number;
}
