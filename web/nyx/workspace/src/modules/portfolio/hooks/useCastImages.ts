"use client";

import { useState, useCallback } from "react";
import { MediaItem } from "@/modules/portfolio/types";
import { mapApiToImages } from "@/modules/portfolio/lib/cast/mappers";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nyx_cast_access_token");
};

interface UseCastImagesOptions {
  uploadUrlPath?: string;
  savePath?: string;
  initialImages?: MediaItem[];
}

export function useCastImages(options: UseCastImagesOptions = {}) {
  const {
    uploadUrlPath = "/api/cast/onboarding/upload-url",
    savePath = "/api/cast/onboarding/images",
    initialImages = [],
  } = options;

  const [images, setImages] = useState<MediaItem[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadImage = useCallback(
    async (file: File): Promise<MediaItem | null> => {
      const token = getToken();
      if (!token) throw new Error("No token");

      setUploading(true);
      setError(null);

      try {
        const res = await fetch(uploadUrlPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get upload URL");
        }

        const { url, key } = await res.json();

        const uploadRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image");

        return {
          url: URL.createObjectURL(file),
          key: key,
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
    [uploadUrlPath]
  );

  const saveImages = useCallback(
    async (overrideImages?: MediaItem[]) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const imagesToSave = overrideImages || images;
      const heroImage = imagesToSave[0];
      const galleryImages = imagesToSave.slice(1);

      const galleryKeys = galleryImages
        .map((img) => img.key || img.url)
        .filter(Boolean);

      const res = await fetch(savePath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileImagePath: heroImage?.key,
          galleryImages: galleryKeys,
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

  const initializeFromApi = useCallback((apiProfile: any) => {
    const mappedImages = mapApiToImages(apiProfile);
    setImages(mappedImages);
    return mappedImages;
  }, []);

  // Helper to get hero and gallery separately
  const getHeroImage = useCallback(() => images[0] || null, [images]);
  const getGalleryImages = useCallback(() => images.slice(1), [images]);
  const getHeroKey = useCallback(() => images[0]?.key, [images]);
  const getGalleryKeys = useCallback(
    () => images.slice(1).map((img) => img.key || img.url).filter(Boolean),
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
    getHeroKey,
    getGalleryKeys,
  };
}
