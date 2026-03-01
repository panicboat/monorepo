// Media module types for UI use

export type MediaType = "image" | "video";

export interface MediaItem {
  id: string;
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt?: string;
}

export interface MediaWithKey extends MediaItem {
  key?: string;
}

export interface UploadedMedia {
  mediaId: string;
  mediaKey: string;
  uploadUrl: string;
  localUrl: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  mediaType: MediaType;
}

export interface UploadProgress {
  uploading: boolean;
  progress: number;
  error: Error | null;
}

export interface MediaUploadOptions {
  onProgress?: (progress: number) => void;
  registerAfterUpload?: boolean;
}
