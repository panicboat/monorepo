"use client";

import { useState, useCallback } from "react";
import { profileRequestHeaders } from "@/lib/auth/profile-headers";
import { useAuthStore } from "@/stores/authStore";
import type { UploadedMedia, MediaType, MediaUploadOptions } from "../types";
import { getMediaTypeFromMime, toProtoMediaType } from "../lib/mappers";
import { isResizableImage, MAIN_MAX_EDGE, MAIN_QUALITY, resizeImage, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY } from "../lib/resize";
import { isStrippableVideo, stripVideoMetadata } from "../lib/video-metadata";

interface PreparedUpload {
  main: Blob;
  thumbnail: Blob | null;
  filename: string;
  contentType: string;
}

async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (isResizableImage(file.type)) {
    try {
      const [main, thumbnail] = await Promise.all([
        resizeImage(file, MAIN_MAX_EDGE, MAIN_QUALITY),
        resizeImage(file, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY),
      ]);
      return { main, thumbnail, filename: `${file.name.replace(/\.[^.]+$/, "")}.jpg`, contentType: "image/jpeg" };
    } catch {
      throw new Error("画像を読み込めませんでした。別の画像を選んでください");
    }
  }
  if (isStrippableVideo(file.type)) {
    try {
      return { main: await stripVideoMetadata(file), thumbnail: null, filename: file.name, contentType: file.type };
    } catch {
      throw new Error("動画を読み込めませんでした。別の動画を選んでください");
    }
  }
  return { main: file, thumbnail: null, filename: file.name, contentType: file.type };
}

async function putObject(body: Blob, filename: string, contentType: string, mediaType: MediaType) {
  const res = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...profileRequestHeaders(),
    },
    body: JSON.stringify({
      filename,
      contentType,
      mediaType: toProtoMediaType(mediaType),
    }),
  });

  if (!res.ok) {
    // FALLBACK: Use an empty object when JSON parsing fails.
    const err = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(err.error || "アップロードに失敗しました");
  }

  const { uploadUrl, mediaKey, mediaId } = (await res.json()) as { uploadUrl: string; mediaKey: string; mediaId: string };

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!uploadRes.ok) {
    throw new Error("ファイルのアップロードに失敗しました");
  }

  return { uploadUrl, mediaKey, mediaId };
}

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

  const registerMedia = useCallback(async (uploaded: UploadedMedia) => {
    if (!useAuthStore.getState().activeProfileId) {
      throw new Error("ログインしてください");
    }

    const res = await fetch("/api/media/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...profileRequestHeaders(),
      },
      body: JSON.stringify({
        mediaId: uploaded.mediaId,
        mediaKey: uploaded.mediaKey,
        ...(uploaded.thumbnailKey ? { thumbnailKey: uploaded.thumbnailKey } : {}),
        mediaType: toProtoMediaType(uploaded.mediaType),
        filename: uploaded.filename,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
      }),
    });

    if (!res.ok) {
      // FALLBACK: Use an empty object when JSON parsing fails.
      const err = await res.json().catch(() => ({} as { error?: string }));
      throw new Error(err.error || "メディアの登録に失敗しました");
    }
  }, []);

  const uploadMedia = useCallback(
    async (
      file: File,
      options: MediaUploadOptions = {}
    ): Promise<UploadedMedia> => {
      if (!useAuthStore.getState().activeProfileId) {
        throw new Error("ログインしてください");
      }

      setUploading(true);
      setError(null);

      try {
        const mediaType: MediaType = getMediaTypeFromMime(file.type);
        const prepared = await prepareUpload(file);
        const { uploadUrl, mediaKey, mediaId } = await putObject(prepared.main, prepared.filename, prepared.contentType, mediaType);
        const thumbnail = prepared.thumbnail
          ? await putObject(prepared.thumbnail, `thumb-${prepared.filename}`, prepared.contentType, mediaType)
          : null;

        const uploaded: UploadedMedia = {
          mediaId,
          mediaKey,
          ...(thumbnail ? { thumbnailKey: thumbnail.mediaKey } : {}),
          uploadUrl,
          localUrl: URL.createObjectURL(prepared.main),
          filename: prepared.filename,
          contentType: prepared.contentType,
          sizeBytes: prepared.main.size,
          mediaType,
        };

        if (options.registerAfterUpload) {
          await registerMedia(uploaded);
        }

        return uploaded;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("アップロードに失敗しました");
        setError(err);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [registerMedia]
  );

  return {
    uploading,
    error,
    uploadMedia,
    registerMedia,
  };
}
