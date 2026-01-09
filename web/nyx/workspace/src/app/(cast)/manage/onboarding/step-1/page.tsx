"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { useOnboarding } from "../context";

export default function OnboardingStep1Page() {
  const router = useRouter();
  const { data, updateProfile } = useOnboarding();

  // Initialize Form State from Context
  const [formData, setFormData] = useState<ProfileFormData>({
    nickname: data.profile?.nickname || "",
    tagline: data.profile?.tagline || "",
    bio: data.profile?.bio || "",
    serviceCategory: data.profile?.serviceCategory || "standard",
    locationType: data.profile?.locationType || "dispatch",
    area: data.profile?.area || "",
    defaultShiftStart: data.profile?.defaultShiftStart || "18:00",
    defaultShiftEnd: data.profile?.defaultShiftEnd || "23:00",
    socialLinks: {
      ...data.profile?.socialLinks,
      others: data.profile?.socialLinks?.others || [],
    },
    tags: [],
  });

  // Handlers (Moved from OnboardingForm)
  const handleChange = (key: keyof ProfileFormData, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSocialChange = (key: keyof ProfileFormData["socialLinks"], val: string) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [key]: val,
      },
    }));
  };

  const handleAddOther = () => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: [...(prev.socialLinks.others || []), ""],
      },
    }));
  };

  const handleRemoveOther = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: (prev.socialLinks.others || []).filter((_, i) => i !== index),
      },
    }));
  };

  const handleOtherChange = (index: number, val: string) => {
    setFormData((prev) => {
      const newOthers = [...(prev.socialLinks.others || [])];
      newOthers[index] = val;
      return {
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          others: newOthers,
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    router.push("/manage/onboarding/step-2");
  };

  const isFormValid =
    formData.nickname.trim().length > 0 &&
    formData.area.trim().length > 0 &&
    formData.tagline.trim().length > 0;

  // Time Options
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? "00" : "30";
    return `${h.toString().padStart(2, "0")}:${m}`;
  });

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Basic Identity</h1>
        <p className="text-sm text-slate-500">
          まずはあなたの基本的なプロフィールと、活動スタイルを教えてください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 2-Axis Business Type */}
        <StyleInputs
          data={formData}
          onChange={handleChange}
          timeOptions={timeOptions}
        />

        {/* Basic Info */}
        <ProfileInputs
          data={formData}
          onChange={handleChange}
        />

        {/* External Links Section */}
        <SocialInputs
          data={formData}
          onSocialChange={handleSocialChange}
          onOtherChange={handleOtherChange}
          onAddOther={handleAddOther}
          onRemoveOther={handleRemoveOther}
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={!isFormValid}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 disabled:bg-slate-300 disabled:shadow-none"
        >
          <span>Next Step: Photos</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
