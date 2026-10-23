const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "m4v", "mkv"];

export type MediaType = "image" | "video";

export function getMediaType(path: string): MediaType {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}

export function getMediaTypeFromMime(mimeType: string): MediaType {
  return mimeType.startsWith("video/") ? "video" : "image";
}
