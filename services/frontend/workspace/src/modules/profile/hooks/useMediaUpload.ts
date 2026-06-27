"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";

export interface UploadResult {
  mediaId: string;
  url: string;
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<UploadResult | null> => {
    if (!useAuthStore.getState().userId) {
      setError("ログインが必要です");
      return null;
    }
    setUploading(true);
    setError(null);
    try {
      const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      const { uploadUrl, mediaKey, mediaId } = await authFetch<{
        uploadUrl: string;
        mediaKey: string;
        mediaId: string;
      }>("/api/media/upload-url", {
        method: "POST",
        body: { filename: file.name, contentType: file.type, mediaType },
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("アップロードに失敗しました");

      const reg = await authFetch<{ media: { id: string; url: string } | null }>(
        "/api/media/register",
        {
          method: "POST",
          body: {
            mediaId,
            mediaKey,
            mediaType,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          },
        }
      );

      return { mediaId, url: reg.media?.url || URL.createObjectURL(file) };
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
