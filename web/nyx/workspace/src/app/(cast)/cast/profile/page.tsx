"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Image as ImageIcon, Tag, Eye, Camera, Shield } from "lucide-react";

import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { PhysicalInputs } from "@/modules/portfolio/components/cast/PhysicalInputs";
import { TagSelector } from "@/modules/portfolio/components/cast/TagSelector";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";
import { ProfilePreviewModal } from "@/modules/portfolio/components/cast/ProfilePreviewModal";
import { VisibilityToggle } from "@/modules/portfolio/components/cast/VisibilityToggle";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { useCastData } from "@/modules/portfolio/hooks";

export default function ProfileEditPage() {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarKey, setAvatarKey] = useState<string>("");

  // Use combined hook with profile API path
  const {
    profile: profileForm,
    images,
    avatarUrl,
    avatarPath,
    plans,
    schedules,
    loading,
    isPrivate,
    updateProfile,
    updateImages,
    saveProfile,
    saveImages,
    uploadImage,
    saveVisibility,
  } = useCastData({ apiPath: "/api/cast/profile" });

  // Initialize avatar from existing data
  useEffect(() => {
    if (avatarUrl && !avatarPreview) {
      setAvatarPreview(avatarUrl);
    }
    if (avatarPath && !avatarKey) {
      setAvatarKey(avatarPath);
    }
  }, [avatarUrl, avatarPath, avatarPreview, avatarKey]);

  // Handlers
  const handleProfileChange = (key: keyof ProfileFormData, val: any) => {
    updateProfile({ [key]: val });
  };

  const handleTagsChange = (newTags: string[]) => {
    updateProfile({ tags: newTags });
  };

  const handleSocialChange = (
    key: keyof ProfileFormData["socialLinks"],
    val: string,
  ) => {
    updateProfile({
      socialLinks: { ...profileForm.socialLinks, [key]: val },
    });
  };

  const handleOtherChange = (index: number, val: string) => {
    const newOthers = [...(profileForm.socialLinks.others || [])];
    newOthers[index] = val;
    updateProfile({
      socialLinks: { ...profileForm.socialLinks, others: newOthers },
    });
  };

  const handleAddOther = () => {
    updateProfile({
      socialLinks: {
        ...profileForm.socialLinks,
        others: [...(profileForm.socialLinks.others || []), ""],
      },
    });
  };

  const handleRemoveOther = (index: number) => {
    updateProfile({
      socialLinks: {
        ...profileForm.socialLinks,
        others: (profileForm.socialLinks.others || []).filter((_, i) => i !== index),
      },
    });
  };

  // Avatar Upload Handler
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { key } = await uploadImage(file);
      setAvatarKey(key);
      setAvatarPreview(URL.createObjectURL(file));
    } catch (err) {
      console.error(err);
    }
  };

  // Image Upload Handler
  const handleUpload = async (file: File): Promise<MediaItem | null> => {
    try {
      const { key } = await uploadImage(file);
      const url = URL.createObjectURL(file);
      return {
        url,
        key,
        type: file.type.startsWith("video") ? "video" : "image",
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Save
  const handleSave = async () => {
    try {
      await saveProfile(profileForm);
      await saveImages(images, avatarKey || undefined);

      toast({
        title: "Saved",
        description: "Profile updated successfully",
        variant: "success",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-role-cast" />
      </div>
    );
  }

  return (
    <div className="pb-24 bg-surface-secondary min-h-screen">
      <div className="px-4 py-6 space-y-6">
        {/* Top Preview Button */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 text-role-cast font-bold bg-surface border border-role-cast-light px-6 py-2 rounded-full hover:bg-role-cast-lighter transition-colors shadow-sm"
          >
            <Eye size={18} />
            <span>Preview Profile</span>
          </button>
        </div>

        {/* Sections */}

        {/* Avatar */}
        <SectionCard
          id="avatar"
          title="Avatar"
          icon={<Camera size={20} />}
          collapsible
          defaultOpen={false}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-secondary transition-all hover:border-role-cast-light hover:bg-role-cast-lighter/30"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Camera className="h-6 w-6 text-text-muted group-hover:text-role-cast transition-colors" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 rounded-full">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleAvatarSelect}
            />
            <div className="text-xs text-text-secondary leading-relaxed">
              <p className="font-medium text-text-secondary">Profile Avatar</p>
              <p>タイムラインやチャットで表示される正方形のアイコンです。</p>
              <p>未設定の場合はカバー写真が使用されます。</p>
            </div>
          </div>
        </SectionCard>

        {/* Photos (Order 1) */}
        <SectionCard
          id="photos"
          title="Photos"
          icon={<ImageIcon size={20} />}
          collapsible
          defaultOpen={false}
        >
          <PhotoUploader images={images} onChange={updateImages} onUpload={handleUpload} />
        </SectionCard>

        {/* Identity (Order 2) */}
        <SectionCard
          id="identity"
          title="Identity"
          icon={<Tag size={20} />}
          collapsible
          defaultOpen={false}
        >
          <ProfileInputs data={profileForm} onChange={handleProfileChange} />
        </SectionCard>

        {/* Work Style (Order 3) */}
        <SectionCard
          id="workstyle"
          title="Work Style"
          icon={
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-secondary text-text-secondary text-xs shadow-sm font-bold">
              W
            </span>
          }
          collapsible
          defaultOpen={false}
        >
          <StyleInputs
            data={profileForm}
            onChange={handleProfileChange}
          />
        </SectionCard>

        {/* Physical Info (Order 4) */}
        <SectionCard
          id="physical"
          title="Physical Info"
          icon={
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-role-cast-light text-role-cast text-xs shadow-sm font-bold">
              P
            </span>
          }
          collapsible
          defaultOpen={false}
        >
          <PhysicalInputs data={profileForm} onChange={handleProfileChange} />
        </SectionCard>

        {/* Tags (Order 5) */}
        <SectionCard
          id="tags"
          title="Tags"
          icon={
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-role-cast-light text-role-cast text-xs shadow-sm font-bold">
              #
            </span>
          }
          collapsible
          defaultOpen={false}
        >
          <TagSelector tags={profileForm.tags} onChange={handleTagsChange} />
        </SectionCard>

        {/* Social (Order 6) */}
        <SectionCard
          id="social"
          title="Social Links"
          icon={
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-info-lighter text-info text-xs shadow-sm font-bold">
              @
            </span>
          }
          collapsible
          defaultOpen={false}
        >
          <SocialInputs
            data={profileForm}
            onSocialChange={handleSocialChange}
            onOtherChange={handleOtherChange}
            onAddOther={handleAddOther}
            onRemoveOther={handleRemoveOther}
          />
        </SectionCard>

        {/* Visibility Settings (Order 7) */}
        <SectionCard
          id="visibility"
          title="Privacy Settings"
          icon={<Shield size={20} />}
          collapsible
          defaultOpen={false}
        >
          <VisibilityToggle
            isPrivate={isPrivate}
            onSave={saveVisibility}
          />
        </SectionCard>
      </div>

      {/* Save Actions */}
      <div className="flex flex-col gap-4 px-4 pb-12 items-center">
        <ActionButton
          mode="save"
          label="Save Profile"
          onClick={handleSave}
          className="max-w-md"
          role="cast"
        />
      </div>

      <ProfilePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        formData={profileForm}
        images={images}
        plans={plans}
        schedules={schedules}
      />
    </div>
  );
}
