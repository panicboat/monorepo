import type { MediaItem, MediaType } from "../types";

// Map proto MediaType enum to string
const MEDIA_TYPE_MAP: Record<number, MediaType> = {
  0: "image", // UNSPECIFIED defaults to image
  1: "image", // IMAGE
  2: "video", // VIDEO
};

// Map string to proto MediaType enum
export function toProtoMediaType(type: MediaType): number {
  return type === "video" ? 2 : 1;
}

// Map API response to MediaItem
export function mapApiToMediaItem(data: {
  id: string;
  mediaType: number;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: string | number | bigint;
  createdAt?: string;
}): MediaItem {
  return {
    id: data.id,
    mediaType: MEDIA_TYPE_MAP[data.mediaType] || "image",
    url: data.url,
    thumbnailUrl: data.thumbnailUrl || undefined,
    filename: data.filename || undefined,
    contentType: data.contentType || undefined,
    sizeBytes: data.sizeBytes ? Number(data.sizeBytes) : undefined,
    createdAt: data.createdAt || undefined,
  };
}

// Map array of API responses to MediaItems
export function mapApiToMediaList(
  data: Array<{
    id: string;
    mediaType: number;
    url: string;
    thumbnailUrl?: string;
    filename?: string;
    contentType?: string;
    sizeBytes?: string | number | bigint;
    createdAt?: string;
  }>
): MediaItem[] {
  return data.map(mapApiToMediaItem);
}

// Determine media type from MIME type
export function getMediaTypeFromMime(mimeType: string): MediaType {
  return mimeType.startsWith("video/") ? "video" : "image";
}

// Determine media type from file extension
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "m4v", "mkv"];

export function getMediaTypeFromPath(path: string): MediaType {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}
