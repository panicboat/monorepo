"use client";

import { useState, useCallback } from "react";
import { getAuthToken } from "@/lib/auth";
import type { UploadedMedia, MediaType, MediaUploadOptions } from "../types";
import { getMediaTypeFromMime, toProtoMediaType } from "../lib/mappers";

interface UseMediaUploadResult {
  uploading: boolean;
  error: Error | null;
  uploadMedia: (
    file: File,
    options?: MediaUploadOptions
  ) => Promise<UploadedMedia>;
  registerMedia: (uploaded: UploadedMedia) => Promise<void>;
}

export function useMediaUpload(): UseMediaUploadResult {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadMedia = useCallback(
    async (
      file: File,
      options: MediaUploadOptions = {}
    ): Promise<UploadedMedia> => {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      setUploading(true);
      setError(null);

      try {
        const mediaType: MediaType = getMediaTypeFromMime(file.type);

        // 1. Get presigned upload URL from Media API
        const res = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            mediaType: toProtoMediaType(mediaType),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get upload URL");
        }

        const { uploadUrl, mediaKey, mediaId } = await res.json();

        // 2. Upload file to presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload file to storage");
        }

        const uploaded: UploadedMedia = {
          mediaId,
          mediaKey,
          uploadUrl,
          localUrl: URL.createObjectURL(file),
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          mediaType,
        };

        // 3. Optionally register media after upload
        if (options.registerAfterUpload) {
          await registerMedia(uploaded);
        }

        return uploaded;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Upload failed");
        setError(err);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const registerMedia = useCallback(async (uploaded: UploadedMedia) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No authentication token");
    }

    const res = await fetch("/api/media/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mediaId: uploaded.mediaId,
        mediaKey: uploaded.mediaKey,
        mediaType: toProtoMediaType(uploaded.mediaType),
        filename: uploaded.filename,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to register media");
    }
  }, []);

  return {
    uploading,
    error,
    uploadMedia,
    registerMedia,
  };
}
