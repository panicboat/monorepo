"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { AvatarUploader } from "@/components/shared/AvatarUploader";
import { GuestProfileFormData } from "@/modules/portfolio/hooks/useGuestData";

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 20;
const TAGLINE_MAX_LENGTH = 100;
const BIO_MAX_LENGTH = 1000;

export interface GuestProfileFormProps {
  initialData?: GuestProfileFormData;
  initialAvatarUrl?: string;
  onSubmit: (data: GuestProfileFormData) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<{ mediaId: string; url: string }>;
  submitLabel: string;
  loading?: boolean;
}

export const GuestProfileForm = ({
  initialData,
  initialAvatarUrl,
  onSubmit,
  onUploadAvatar,
  submitLabel,
  loading: externalLoading = false,
}: GuestProfileFormProps) => {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarMediaId, setAvatarMediaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setTagline(initialData.tagline || "");
      setBio(initialData.bio || "");
      setAvatarMediaId(initialData.avatarMediaId || null);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialAvatarUrl) {
      setCurrentAvatarUrl(initialAvatarUrl);
    }
  }, [initialAvatarUrl]);

  const nameError =
    name.length > 0 && name.length > NAME_MAX_LENGTH
      ? `${NAME_MAX_LENGTH}文字以内で入力してください`
      : null;

  const taglineError =
    tagline.length > TAGLINE_MAX_LENGTH
      ? `${TAGLINE_MAX_LENGTH}文字以内で入力してください`
      : null;

  const bioError =
    bio.length > BIO_MAX_LENGTH
      ? `${BIO_MAX_LENGTH}文字以内で入力してください`
      : null;

  const isValid =
    name.trim().length >= NAME_MIN_LENGTH &&
    name.length <= NAME_MAX_LENGTH &&
    tagline.length <= TAGLINE_MAX_LENGTH &&
    bio.length <= BIO_MAX_LENGTH;

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const result = await onUploadAvatar(file);
        setAvatarMediaId(result.mediaId);
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
    [onUploadAvatar]
  );

  const handleAvatarClear = useCallback(() => {
    setCurrentAvatarUrl(null);
    setAvatarMediaId(null);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await onSubmit({
        name: name.trim(),
        avatarMediaId: avatarMediaId || "",
        tagline: tagline.trim(),
        bio: bio.trim(),
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

  const isLoading = externalLoading || uploading || saving;

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex flex-col items-center gap-4">
        <AvatarUploader
          mediaUrl={currentAvatarUrl || undefined}
          onUpload={handleAvatarUpload}
          onClear={handleAvatarClear}
          size="lg"
        />
        <p className="text-xs text-text-muted">タップして変更</p>
      </div>

      {/* Name Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          ニックネーム <span className="text-error">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ニックネームを入力"
          maxLength={NAME_MAX_LENGTH + 5}
          className={`w-full px-4 py-3 rounded-xl border ${
            nameError
              ? "border-error-light focus:ring-error focus:border-error"
              : "border-border focus:ring-info focus:border-info"
          } focus:outline-none focus:ring-2 transition-colors bg-surface`}
          disabled={isLoading}
        />
        <div className="flex justify-between items-center">
          {nameError ? (
            <p className="text-xs text-error">{nameError}</p>
          ) : (
            <p className="text-xs text-text-muted">
              {NAME_MIN_LENGTH}〜{NAME_MAX_LENGTH}文字
            </p>
          )}
          <p
            className={`text-xs ${name.length > NAME_MAX_LENGTH ? "text-error" : "text-text-muted"}`}
          >
            {name.length}/{NAME_MAX_LENGTH}
          </p>
        </div>
      </div>

      {/* Tagline Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          一言紹介
        </label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="例: 映画と猫が好きです"
          maxLength={TAGLINE_MAX_LENGTH + 10}
          className={`w-full px-4 py-3 rounded-xl border ${
            taglineError
              ? "border-error-light focus:ring-error focus:border-error"
              : "border-border focus:ring-info focus:border-info"
          } focus:outline-none focus:ring-2 transition-colors bg-surface`}
          disabled={isLoading}
        />
        <div className="flex justify-between items-center">
          {taglineError ? (
            <p className="text-xs text-error">{taglineError}</p>
          ) : (
            <p className="text-xs text-text-muted">任意</p>
          )}
          <p
            className={`text-xs ${tagline.length > TAGLINE_MAX_LENGTH ? "text-error" : "text-text-muted"}`}
          >
            {tagline.length}/{TAGLINE_MAX_LENGTH}
          </p>
        </div>
      </div>

      {/* Bio Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          自己紹介
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="自己紹介を入力してください"
          maxLength={BIO_MAX_LENGTH + 50}
          rows={5}
          className={`w-full px-4 py-3 rounded-xl border ${
            bioError
              ? "border-error-light focus:ring-error focus:border-error"
              : "border-border focus:ring-info focus:border-info"
          } focus:outline-none focus:ring-2 transition-colors bg-surface resize-none`}
          disabled={isLoading}
        />
        <div className="flex justify-between items-center">
          {bioError ? (
            <p className="text-xs text-error">{bioError}</p>
          ) : (
            <p className="text-xs text-text-muted">任意</p>
          )}
          <p
            className={`text-xs ${bio.length > BIO_MAX_LENGTH ? "text-error" : "text-text-muted"}`}
          >
            {bio.length}/{BIO_MAX_LENGTH}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-error-lighter border border-error-light"
        >
          <p className="text-sm text-error">{error}</p>
        </motion.div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-success-lighter border border-success-light"
        >
          <p className="text-sm text-success">プロフィールを保存しました</p>
        </motion.div>
      )}

      {/* Submit Button */}
      <motion.button
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        whileTap={isValid && !isLoading ? { scale: 0.98 } : {}}
        className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
          isValid && !isLoading
            ? "bg-info hover:bg-info-hover shadow-lg shadow-info/30"
            : "bg-border-secondary cursor-not-allowed"
        }`}
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            保存中...
          </span>
        ) : (
          submitLabel
        )}
      </motion.button>
    </div>
  );
};
