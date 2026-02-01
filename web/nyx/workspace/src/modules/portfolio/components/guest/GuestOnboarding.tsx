"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { GuestProfileForm } from "./GuestProfileForm";
import { useGuestData, GuestProfileFormData } from "@/modules/portfolio/hooks/useGuestData";

export const GuestOnboarding = () => {
  const router = useRouter();
  const { profile, avatarUrl, saveProfile, uploadAvatar, loading: dataLoading } = useGuestData();

  const handleSubmit = useCallback(
    async (data: GuestProfileFormData) => {
      await saveProfile(data);
      router.push("/");
    },
    [saveProfile, router]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <main className="flex-1 px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              プロフィール設定
            </h1>
            <p className="text-sm text-slate-500">
              あなたのプロフィールを設定してください
            </p>
          </div>

          <GuestProfileForm
            initialData={profile}
            initialAvatarUrl={avatarUrl}
            onSubmit={handleSubmit}
            onUploadAvatar={uploadAvatar}
            submitLabel="はじめる"
            loading={dataLoading}
          />

          {/* Skip Option */}
          <p className="text-center text-xs text-slate-400">
            後からマイページでいつでも変更できます
          </p>
        </motion.div>
      </main>
    </div>
  );
};
