"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { GuestProfileForm } from "./GuestProfileForm";
import { useGuestData, GuestProfileFormData } from "@/modules/portfolio/hooks/useGuestData";

export const GuestProfileEdit = () => {
  const router = useRouter();
  const {
    profile,
    avatarUrl,
    loading: dataLoading,
    saveProfile,
    uploadAvatar,
  } = useGuestData();

  const handleSubmit = useCallback(
    async (data: GuestProfileFormData) => {
      await saveProfile(data);
    },
    [saveProfile]
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-900">プロフィール編集</h1>
          <div className="w-6" />
        </div>
      </div>

      <main className="p-6">
        <GuestProfileForm
          initialData={profile}
          initialAvatarUrl={avatarUrl}
          onSubmit={handleSubmit}
          onUploadAvatar={uploadAvatar}
          submitLabel="保存する"
          loading={dataLoading}
        />
      </main>
    </div>
  );
};
