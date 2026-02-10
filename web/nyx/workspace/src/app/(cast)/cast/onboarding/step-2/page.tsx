"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera } from "lucide-react";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";
import { MediaItem } from "@/modules/portfolio/types";
import { useCastData } from "@/modules/portfolio/hooks";

export default function OnboardingStep2() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // Local state for newly uploaded avatar (overrides external data)
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [localAvatarKey, setLocalAvatarKey] = useState<string | null>(null);

  const {
    images,
    avatarUrl,
    avatarPath,
    loading,
    initialized,
    fetchData,
    updateImages,
    saveImages,
    uploadImage,
  } = useCastData();

  // Derived values: use local upload if available, otherwise fall back to external data
  const avatarPreview = localAvatarPreview ?? avatarUrl ?? "";
  const avatarKey = localAvatarKey ?? avatarPath ?? "";

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchData();
    }
  }, [initialized, fetchData]);

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

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { key } = await uploadImage(file);
      setLocalAvatarKey(key);
      setLocalAvatarPreview(URL.createObjectURL(file));
    } catch (err) {
      console.error(err);
    }
  };

  const handleImagesChange = (newImages: MediaItem[]) => {
    updateImages(newImages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length < 1) return;

    await saveImages(images, avatarKey || undefined);
    router.push("/cast/onboarding/step-3");
  };

  const isNextEnabled = images.length >= 1;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-role-cast border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-text-primary flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm text-white">
            2
          </span>
          Photos
        </h2>
        <p className="text-sm text-text-secondary">
          魅力的な写真をアップロードして、
          <br />
          ゲストにアピールしましょう。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Upload */}
        <div className="rounded-2xl bg-surface p-5 shadow-sm border border-border">
          <h3 className="text-sm font-bold text-text-secondary mb-4">Avatar</h3>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-secondary transition-all hover:border-role-cast-light hover:bg-role-cast-lighter/30"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Camera className="h-6 w-6 text-text-muted group-hover:text-role-cast transition-colors" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 rounded-full">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleAvatarSelect}
            />
            <div className="text-xs text-text-secondary leading-relaxed">
              <p className="font-medium text-text-secondary">Profile Avatar</p>
              <p>タイムラインやチャットで表示される正方形のアイコンです。</p>
              <p>未設定の場合はカバー写真が使用されます。</p>
            </div>
          </div>
        </div>

        {/* Gallery Photos */}
        <div className="rounded-2xl bg-surface p-5 shadow-sm border border-border">
          <PhotoUploader
            images={images}
            onChange={handleImagesChange}
            onUpload={handleUpload}
            minImages={3}
          />
        </div>

        <button
          type="submit"
          disabled={!isNextEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-role-cast py-4 font-bold text-white shadow-lg shadow-role-cast-shadow transition-all hover:bg-role-cast-hover hover:shadow-role-cast-shadow disabled:bg-neutral-300 disabled:shadow-none"
        >
          <span>Next Step: Service Plans</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
