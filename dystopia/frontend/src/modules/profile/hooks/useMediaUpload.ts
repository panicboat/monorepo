"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";
import { isResizableImage, MAIN_MAX_EDGE, MAIN_QUALITY, resizeImage } from "@/modules/media/lib/resize";

export interface UploadResult {
  mediaId: string;
  url: string;
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<UploadResult | null> => {
    if (!useAuthStore.getState().activeProfileId) {
      setError("ログインが必要です");
      return null;
    }
    setUploading(true);
    setError(null);
    try {
      const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      let body: Blob = file;
      let filename = file.name;
      let contentType = file.type;
      if (isResizableImage(file.type)) {
        try {
          body = await resizeImage(file, MAIN_MAX_EDGE, MAIN_QUALITY);
        } catch {
          throw new Error("画像を読み込めませんでした。別の画像を選んでください");
        }
        filename = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
        contentType = "image/jpeg";
      }
      const { uploadUrl, mediaKey, mediaId } = await authFetch<{
        uploadUrl: string;
        mediaKey: string;
        mediaId: string;
      }>("/api/media/upload-url", {
        method: "POST",
        body: { filename, contentType, mediaType },
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
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
            filename,
            contentType,
            sizeBytes: body.size,
          },
        }
      );

      return { mediaId, url: reg.media?.url || URL.createObjectURL(body) };
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
