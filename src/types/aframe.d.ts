declare module "aframe" {
  interface AFrameGlobal {
    registerComponent: (
      name: string,
      definition: Record<string, unknown>
    ) => void;
    scenes: HTMLElement[];
  }

  const AFRAME: AFrameGlobal;
  export default AFRAME;
}
