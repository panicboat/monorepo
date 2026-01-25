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
