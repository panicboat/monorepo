import { fitWithin, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY } from "./resize";

export const THUMBNAIL_TIME_SECONDS = 10;
export const CAPTURE_TIMEOUT_MS = 5000;

// Decoding several videos at once can exhaust iPhone memory, so captures run one at a time.
let queue: Promise<unknown> = Promise.resolve();

export function thumbnailTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration >= THUMBNAIL_TIME_SECONDS ? THUMBNAIL_TIME_SECONDS : duration / 2;
}

// iPhone Safari draws no frame for a paused video without a poster, so the fragment makes it draw the frame at 0.1s.
export function videoSrcWithFrame(url: string): string {
  return `${url}#t=0.1`;
}

function captureFrame(file: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const url = URL.createObjectURL(file);
    const listeners = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      listeners.abort();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(blob);
    };

    const drawFrame = () => {
      try {
        const { width, height } = fitWithin(video.videoWidth, video.videoHeight, THUMBNAIL_MAX_EDGE);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          // FALLBACK: no 2D context, so no thumbnail
          finish(null);
          return;
        }
        context.drawImage(video, 0, 0, width, height);
        // FALLBACK: a null blob from toBlob is passed on as no thumbnail
        canvas.toBlob(finish, "image/jpeg", THUMBNAIL_QUALITY);
      } catch {
        // FALLBACK: a failed draw means no thumbnail
        finish(null);
      }
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = thumbnailTime(video.duration);
      },
      { signal: listeners.signal },
    );
    video.addEventListener("seeked", drawFrame, { signal: listeners.signal });
    // FALLBACK: a video the device cannot decode has no thumbnail
    video.addEventListener("error", () => finish(null), { signal: listeners.signal });
    // FALLBACK: a video that never becomes drawable has no thumbnail
    timer = setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS);
    video.src = url;
  });
}

export function captureVideoThumbnail(file: Blob): Promise<Blob | null> {
  // FALLBACK: an unexpected throw becomes null so it cannot stall the captures queued behind it
  const result = queue.then(() => captureFrame(file)).catch(() => null);
  queue = result;
  return result;
}
