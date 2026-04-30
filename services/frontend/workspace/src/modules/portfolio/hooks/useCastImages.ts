"use client";

import { useState, useCallback } from "react";
import { MediaItem, ApiProfile } from "@/modules/portfolio/types";
import { mapApiToImages } from "@/modules/portfolio/lib/cast/mappers";
import { getAuthToken } from "@/lib/swr";

interface UseCastImagesOptions {
  savePath?: string;
  initialImages?: MediaItem[];
}

export function useCastImages(options: UseCastImagesOptions = {}) {
  const {
    savePath = "/api/cast/onboarding/images",
    initialImages = [],
  } = options;

  const [images, setImages] = useState<MediaItem[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadImage = useCallback(
    async (file: File): Promise<MediaItem | null> => {
      const token = getAuthToken();
      if (!token) throw new Error("No token");

      setUploading(true);
      setError(null);

      try {
        // Use Media service for upload
        const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
        const res = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            mediaType,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get upload URL");
        }

        const { uploadUrl, mediaKey, mediaId } = await res.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image");

        return {
          url: URL.createObjectURL(file),
          key: mediaKey,
          mediaId: mediaId,
          type: file.type.startsWith("video") ? "video" : "image",
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Upload failed");
        setError(err);
        return null;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const saveImages = useCallback(
    async (overrideImages?: MediaItem[]) => {
      const token = getAuthToken();
      if (!token) throw new Error("No token");

      const imagesToSave = overrideImages || images;
      const heroImage = imagesToSave[0];
      const galleryImages = imagesToSave.slice(1);

      const galleryMediaIds = galleryImages
        .map((img) => img.mediaId)
        .filter((id): id is string => !!id);

      const res = await fetch(savePath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileMediaId: heroImage?.mediaId,
          galleryMediaIds,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save images");
      }

      return res.json();
    },
    [savePath, images]
  );

  const updateImages = useCallback((newImages: MediaItem[]) => {
    setImages(newImages);
  }, []);

  const initializeFromApi = useCallback((apiProfile: ApiProfile) => {
    const mappedImages = mapApiToImages(apiProfile);
    setImages(mappedImages);
    return mappedImages;
  }, []);

  // Helper to get hero and gallery separately
  const getHeroImage = useCallback(() => images[0] || null, [images]);
  const getGalleryImages = useCallback(() => images.slice(1), [images]);
  const getHeroMediaId = useCallback(() => images[0]?.mediaId, [images]);
  const getGalleryMediaIds = useCallback(
    () => images.slice(1).map((img) => img.mediaId).filter((id): id is string => !!id),
    [images]
  );

  return {
    images,
    uploading,
    error,
    uploadImage,
    saveImages,
    updateImages,
    setImages,
    initializeFromApi,
    getHeroImage,
    getGalleryImages,
    getHeroMediaId,
    getGalleryMediaIds,
  };
}
