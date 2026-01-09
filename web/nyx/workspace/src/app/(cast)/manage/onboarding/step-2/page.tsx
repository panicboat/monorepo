"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";

import { useOnboarding } from "../context";

export default function OnboardingStep2() {
  const router = useRouter();
  const { data, updatePhotos } = useOnboarding();
  const [images, setImages] = useState<string[]>(data.photos.gallery || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length < 1) return;

    // Save to context
    updatePhotos({ gallery: images, cover: images[0] });
    router.push("/manage/onboarding/step-3");
  };

  const isNextEnabled = images.length >= 1;

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
          <PhotoUploader images={images} onChange={setImages} minImages={3} />
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
