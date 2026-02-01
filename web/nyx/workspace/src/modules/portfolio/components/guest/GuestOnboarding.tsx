"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AvatarUploader } from "@/components/shared/AvatarUploader";
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 20;

export const GuestOnboarding = () => {
  const router = useRouter();
  const { saveProfile, uploadAvatar, loading: dataLoading } = useGuestData();

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = name.length > 0 && name.length > NAME_MAX_LENGTH
    ? `${NAME_MAX_LENGTH}文字以内で入力してください`
    : null;

  const isValid = name.trim().length >= NAME_MIN_LENGTH && name.length <= NAME_MAX_LENGTH;

  const handleAvatarUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadAvatar(file);
      setAvatarPath(result.key);
      setAvatarUrl(result.url);
      return result;
    } catch (e) {
      setError("画像のアップロードに失敗しました");
      console.error("Avatar upload failed:", e);
      throw e;
    } finally {
      setUploading(false);
    }
  }, [uploadAvatar]);

  const handleAvatarClear = useCallback(() => {
    setAvatarUrl(null);
    setAvatarPath(null);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || saving) return;

    setSaving(true);
    setError(null);
    try {
      await saveProfile({
        name: name.trim(),
        avatarPath: avatarPath || "",
      });
      router.push("/");
    } catch (e) {
      setError("プロフィールの保存に失敗しました");
      console.error("Profile save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = dataLoading || uploading || saving;

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
              あなたのニックネームを設定してください
            </p>
          </div>

          {/* Avatar Section */}
          <div className="flex justify-center">
            <AvatarUploader
              mediaUrl={avatarUrl || undefined}
              onUpload={handleAvatarUpload}
              onClear={handleAvatarClear}
              size="lg"
            />
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
              } focus:outline-none focus:ring-2 transition-colors`}
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
              <p className={`text-xs ${name.length > NAME_MAX_LENGTH ? "text-red-500" : "text-slate-400"}`}>
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
              "はじめる"
            )}
          </motion.button>

          {/* Skip Option */}
          <p className="text-center text-xs text-slate-400">
            後からマイページでいつでも変更できます
          </p>
        </motion.div>
      </main>
    </div>
  );
};
