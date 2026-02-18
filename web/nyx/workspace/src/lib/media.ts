import { getAuthToken } from "./auth";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "m4v", "mkv"];

export type MediaType = "image" | "video";

/**
 * Determine media type from file path or URL based on extension
 */
export function getMediaType(path: string): MediaType {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}

/**
 * Determine media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType {
  return mimeType.startsWith("video/") ? "video" : "image";
}

export interface UploadResult {
  mediaId: string;
  mediaKey: string;
}

/**
 * Upload a file to storage and return the media ID and key
 */
export async function uploadFile(file: File): Promise<UploadResult | null> {
  const token = getAuthToken();
  if (!token) return null;

  const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
  const res = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
  return { mediaId, mediaKey };
}
