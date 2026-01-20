"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { useOnboardingStore } from "@/stores/onboarding";

export default function OnboardingStep1Page() {
  const router = useRouter();

  // Zustand store
  const profile = useOnboardingStore((s) => s.profile);
  const setProfile = useOnboardingStore((s) => s.setProfile);
  const saveProfile = useOnboardingStore((s) => s.saveProfile);
  const loading = useOnboardingStore((s) => s.loading);
  const initialized = useOnboardingStore((s) => s.initialized);
  const fetchProfile = useOnboardingStore((s) => s.fetchProfile);

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchProfile();
    }
  }, [initialized, fetchProfile]);

  // Handlers
  const handleChange = (key: keyof ProfileFormData, val: any) => {
    setProfile({ [key]: val });
  };

  const handleSocialChange = (
    key: keyof ProfileFormData["socialLinks"],
    val: string
  ) => {
    setProfile({
      socialLinks: {
        ...profile.socialLinks,
        [key]: val,
      },
    });
  };

  const handleAddOther = () => {
    setProfile({
      socialLinks: {
        ...profile.socialLinks,
        others: [...(profile.socialLinks.others || []), ""],
      },
    });
  };

  const handleRemoveOther = (index: number) => {
    setProfile({
      socialLinks: {
        ...profile.socialLinks,
        others: (profile.socialLinks.others || []).filter((_, i) => i !== index),
      },
    });
  };

  const handleOtherChange = (index: number, val: string) => {
    const newOthers = [...(profile.socialLinks.others || [])];
    newOthers[index] = val;
    setProfile({
      socialLinks: {
        ...profile.socialLinks,
        others: newOthers,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile(profile);
    router.push("/cast/onboarding/step-2");
  };

  const isFormValid =
    profile.nickname.trim().length > 0 &&
    profile.area.trim().length > 0 &&
    profile.tagline.trim().length > 0;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

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
        <StyleInputs data={profile} onChange={handleChange} />

        {/* Basic Info */}
        <ProfileInputs data={profile} onChange={handleChange} />

        {/* External Links Section */}
        <SocialInputs
          data={profile}
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
