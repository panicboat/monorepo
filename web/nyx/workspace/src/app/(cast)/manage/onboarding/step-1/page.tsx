"use client";

import { ProfileEditForm, ProfileFormData } from "@/modules/portfolio/components/cast/ProfileEditForm";
import { useRouter } from "next/navigation";

import { useOnboarding } from "../context";

export default function OnboardingStep1Page() {
  const router = useRouter();
  const { data, updateProfile } = useOnboarding();

  const handleNext = (formData: ProfileFormData) => {
    updateProfile(formData);
    router.push("/manage/onboarding/step-2");
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Basic Identity</h1>
        <p className="text-sm text-slate-500">
          まずはあなたの基本的なプロフィールと、活動スタイルを教えてください。
        </p>
      </div>

      <ProfileEditForm initialData={data.profile} onSubmit={handleNext} />
    </div>
  );
}
