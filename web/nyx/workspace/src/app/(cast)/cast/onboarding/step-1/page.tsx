"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { useCastData } from "@/modules/portfolio/hooks";

export default function OnboardingStep1Page() {
  const router = useRouter();

  const {
    profile,
    loading,
    initialized,
    fetchData,
    updateProfile,
    saveProfile,
  } = useCastData();

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchData();
    }
  }, [initialized, fetchData]);

  // Handlers
  const handleChange = (key: keyof ProfileFormData, val: any) => {
    updateProfile({ [key]: val });
  };

  const handleSocialChange = (
    key: keyof ProfileFormData["socialLinks"],
    val: string
  ) => {
    updateProfile({
      socialLinks: {
        ...profile.socialLinks,
        [key]: val,
      },
    });
  };

  const handleAddOther = () => {
    updateProfile({
      socialLinks: {
        ...profile.socialLinks,
        others: [...(profile.socialLinks.others || []), ""],
      },
    });
  };

  const handleRemoveOther = (index: number) => {
    updateProfile({
      socialLinks: {
        ...profile.socialLinks,
        others: (profile.socialLinks.others || []).filter((_, i) => i !== index),
      },
    });
  };

  const handleOtherChange = (index: number, val: string) => {
    const newOthers = [...(profile.socialLinks.others || [])];
    newOthers[index] = val;
    updateProfile({
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
    profile.handle.trim().length >= 3 &&
    (profile.genreIds?.length || 0) > 0 &&
    (profile.areaIds?.length || 0) > 0 &&
    profile.tagline.trim().length > 0;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-role-cast border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Basic Identity</h1>
        <p className="text-sm text-text-secondary">
          まずはあなたの基本的なプロフィールと、活動スタイルを教えてください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <ProfileInputs data={profile} onChange={handleChange} />

        {/* 2-Axis Business Type */}
        <StyleInputs data={profile} onChange={handleChange} />

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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-role-cast py-4 font-bold text-white shadow-lg shadow-role-cast-shadow transition-all hover:bg-role-cast-hover hover:shadow-role-cast-shadow disabled:bg-neutral-300 disabled:shadow-none"
        >
          <span>Next Step: Photos</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
