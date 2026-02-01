"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AvatarUploader } from "@/components/shared/AvatarUploader";
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 20;

export const GuestProfileEdit = () => {
  const router = useRouter();
  const {
    profile,
    avatarUrl,
    loading: dataLoading,
    saveProfile,
    uploadAvatar,
  } = useGuestData();

  const [name, setName] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setAvatarPath(profile.avatarPath || null);
    }
  }, [profile]);

  useEffect(() => {
    if (avatarUrl) {
      setCurrentAvatarUrl(avatarUrl);
    }
  }, [avatarUrl]);

  const nameError =
    name.length > 0 && name.length > NAME_MAX_LENGTH
      ? `${NAME_MAX_LENGTH}文字以内で入力してください`
      : null;

  const isValid =
    name.trim().length >= NAME_MIN_LENGTH && name.length <= NAME_MAX_LENGTH;

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const result = await uploadAvatar(file);
        setAvatarPath(result.key);
        setCurrentAvatarUrl(result.url);
        return result;
      } catch (e) {
        setError("画像のアップロードに失敗しました");
        console.error("Avatar upload failed:", e);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [uploadAvatar]
  );

  const handleAvatarClear = useCallback(() => {
    setCurrentAvatarUrl(null);
    setAvatarPath(null);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await saveProfile({
        name: name.trim(),
        avatarPath: avatarPath || "",
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError("プロフィールの保存に失敗しました");
      console.error("Profile save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = dataLoading || uploading || saving;

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

      <main className="p-6 space-y-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4">
          <AvatarUploader
            mediaUrl={currentAvatarUrl || undefined}
            onUpload={handleAvatarUpload}
            onClear={handleAvatarClear}
            size="lg"
          />
          <p className="text-xs text-slate-400">タップして変更</p>
        </div>

        {/* Name Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            ニックネーム <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ニックネームを入力"
            maxLength={NAME_MAX_LENGTH + 5}
            className={`w-full px-4 py-3 rounded-xl border ${
              nameError
                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                : "border-slate-200 focus:ring-blue-500 focus:border-blue-500"
            } focus:outline-none focus:ring-2 transition-colors bg-white`}
            disabled={isLoading}
          />
          <div className="flex justify-between items-center">
            {nameError ? (
              <p className="text-xs text-red-500">{nameError}</p>
            ) : (
              <p className="text-xs text-slate-400">
                {NAME_MIN_LENGTH}〜{NAME_MAX_LENGTH}文字
              </p>
            )}
            <p
              className={`text-xs ${name.length > NAME_MAX_LENGTH ? "text-red-500" : "text-slate-400"}`}
            >
              {name.length}/{NAME_MAX_LENGTH}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-50 border border-red-100"
          >
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}

        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-green-50 border border-green-100"
          >
            <p className="text-sm text-green-600">
              プロフィールを保存しました
            </p>
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          whileTap={isValid && !isLoading ? { scale: 0.98 } : {}}
          className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
            isValid && !isLoading
              ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/30"
              : "bg-slate-300 cursor-not-allowed"
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              保存中...
            </span>
          ) : (
            "保存する"
          )}
        </motion.button>
      </main>
    </div>
  );
};
