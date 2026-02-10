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

/**
 * Upload a file to storage and return the storage key
 */
export async function uploadFile(file: File): Promise<string | null> {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch("/api/cast/onboarding/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });

  if (!res.ok) return null;
  const { url, key } = await res.json();

  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) return null;
  return key;
}
