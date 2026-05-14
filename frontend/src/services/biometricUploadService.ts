import { apiClient } from "./apiClient";

export type CapturePosition = "center" | "right" | "left";
export type FrameUploadResult = { position: CapturePosition; urls: string[] };

export const captureFrameFromVideo = (
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) {
      reject(new Error("Video not ready (zero dimensions)"));
      return;
    }
    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) {
      reject(new Error("Failed to obtain 2D canvas context"));
      return;
    }
    ctx.drawImage(videoEl, 0, 0, w, h);
    canvasEl.toBlob(
      (blob) => {
        if (!blob) reject(new Error("canvas.toBlob produced no Blob"));
        else resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });

export const getSignedUploadUrl = (
  applicationId: string,
  fileName: string,
): Promise<{ signedUrl: string; path: string }> =>
  apiClient.post<{ signedUrl: string; path: string }>(
    "/storage/biometrics/upload-url",
    { applicationId, fileName },
  );

export const uploadFrameToStorage = async (
  signedUrl: string,
  blob: Blob,
): Promise<void> => {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Frame upload failed (${res.status}): ${text || res.statusText}`,
    );
  }
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const captureAndUploadFrames = async (
  applicationId: string,
  position: CapturePosition,
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement,
  frameCount: number = 3,
): Promise<string[]> => {
  const paths: string[] = [];
  for (let n = 1; n <= frameCount; n++) {
    const fileName = `face_${position}_${n}.jpg`;
    const blob = await captureFrameFromVideo(videoEl, canvasEl);
    const { signedUrl, path } = await getSignedUploadUrl(
      applicationId,
      fileName,
    );
    await uploadFrameToStorage(signedUrl, blob);
    paths.push(path);
    if (n < frameCount) await delay(1600);
  }
  return paths;
};

export const saveBiometricFrameUrls = (
  applicationId: string,
  allFramePaths: string[],
): Promise<{ success: true }> =>
  apiClient.patch<{ success: true }>(
    `/applications/${applicationId}/biometric-frames`,
    { frameUrls: allFramePaths },
  );
