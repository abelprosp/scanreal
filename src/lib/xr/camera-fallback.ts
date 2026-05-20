export async function startCameraPreview(
  video: HTMLVideoElement
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Câmera não disponível neste navegador.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();

  return stream;
}

export function stopCameraPreview(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
