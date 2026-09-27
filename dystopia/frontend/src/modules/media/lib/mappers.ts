import type { MediaItem, MediaType } from "../types";

const MEDIA_TYPE_MAP: Record<number, MediaType> = {
  0: "image",
  1: "image",
  2: "video",
};

export function toProtoMediaType(type: MediaType): number {
  return type === "video" ? 2 : 1;
}

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

export function getMediaTypeFromMime(mimeType: string): MediaType {
  return mimeType.startsWith("video/") ? "video" : "image";
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "m4v", "mkv"];

export function getMediaTypeFromPath(path: string): MediaType {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}
