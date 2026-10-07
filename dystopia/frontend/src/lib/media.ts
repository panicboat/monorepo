import { useAuthStore } from "@/stores/authStore";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "m4v", "mkv"];

export type MediaType = "image" | "video";

export function getMediaType(path: string): MediaType {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}

export function getMediaTypeFromMime(mimeType: string): MediaType {
  return mimeType.startsWith("video/") ? "video" : "image";
}

export interface UploadResult {
  mediaId: string;
  mediaKey: string;
}

export async function uploadFile(file: File): Promise<UploadResult | null> {
  if (!useAuthStore.getState().accountId) return null;

  const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
  const res = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      mediaType,
    }),
  });

  if (!res.ok) return null;
  const { uploadUrl, mediaKey, mediaId } = await res.json();

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) return null;

  const registerRes = await fetch("/api/media/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mediaId,
      mediaKey,
      mediaType,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });

  if (!registerRes.ok) return null;

  return { mediaId, mediaKey };
}
