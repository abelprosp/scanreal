/** iOS 13+ exige permissão explícita para orientação/movimento */
export async function requestMotionPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const OrientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
  };

  if (typeof OrientationEvent.requestPermission === "function") {
    try {
      const state = await OrientationEvent.requestPermission();
      return state === "granted";
    } catch {
      return false;
    }
  }

  return true;
}
