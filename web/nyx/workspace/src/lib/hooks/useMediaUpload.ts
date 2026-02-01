"use client";

import { useState, useCallback } from "react";

interface UseMediaUploadOptions {
  uploadUrlPath: string;
  getToken: () => string | null;
}

interface UploadResult {
  url: string;
  key: string;
}

export function useMediaUpload({ uploadUrlPath, getToken }: UseMediaUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadMedia = useCallback(
    async (file: File): Promise<UploadResult> => {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      setUploading(true);
      setError(null);

      try {
        // Get presigned upload URL
        const res = await fetch(uploadUrlPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get upload URL");
        }

        const { url, key } = await res.json();

        // Upload file to presigned URL
        const uploadRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload file");
        }

        return {
          url: URL.createObjectURL(file),
          key,
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Upload failed");
        setError(err);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [uploadUrlPath, getToken]
  );

  return {
    uploading,
    error,
    uploadMedia,
  };
}
