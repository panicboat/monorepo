
export type MediaType = "image" | "video";

export interface UploadedMedia {
  mediaId: string;
  mediaKey: string;
  thumbnailKey?: string;
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
