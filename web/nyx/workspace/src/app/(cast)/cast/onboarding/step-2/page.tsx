"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";
import { MediaItem } from "@/modules/portfolio/types";
import { useOnboardingStore, PhotoItem } from "@/stores/onboarding";

export default function OnboardingStep2() {
  const router = useRouter();

  // Zustand store
  const photos = useOnboardingStore((s) => s.photos);
  const setPhotos = useOnboardingStore((s) => s.setPhotos);
  const uploadImage = useOnboardingStore((s) => s.uploadImage);
  const saveImages = useOnboardingStore((s) => s.saveImages);
  const loading = useOnboardingStore((s) => s.loading);
  const initialized = useOnboardingStore((s) => s.initialized);
  const fetchProfile = useOnboardingStore((s) => s.fetchProfile);

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchProfile();
    }
  }, [initialized, fetchProfile]);

  const handleUpload = async (file: File): Promise<MediaItem | null> => {
    try {
      const { key } = await uploadImage(file);
      const url = URL.createObjectURL(file);
      return {
        url,
        key,
        type: file.type.startsWith("video") ? "video" : "image",
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleImagesChange = (images: MediaItem[]) => {
    // Convert MediaItem[] to PhotoItem[]
    const photoItems: PhotoItem[] = images.map((img) => ({
      id: img.id,
      url: img.url,
      key: img.key,
      type: img.type as "image" | "video",
    }));
    setPhotos({ gallery: photoItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.gallery.length < 1) return;

    await saveImages(photos.gallery);
    router.push("/cast/onboarding/step-3");
  };

  const isNextEnabled = photos.gallery.length >= 1;

  // Convert PhotoItem[] to MediaItem[] for PhotoUploader
  const galleryAsMediaItems: MediaItem[] = photos.gallery.map((p) => ({
    id: p.id,
    url: p.url,
    key: p.key,
    type: p.type,
  }));

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
            2
          </span>
          Photos
        </h2>
        <p className="text-sm text-slate-500">
          魅力的な写真をアップロードして、
          <br />
          ゲストにアピールしましょう。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <PhotoUploader
            images={galleryAsMediaItems}
            onChange={handleImagesChange}
            onUpload={handleUpload}
            minImages={3}
          />
        </div>

        <button
          type="submit"
          disabled={!isNextEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 disabled:bg-slate-300 disabled:shadow-none"
        >
          <span>Next Step: Service Plans</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
