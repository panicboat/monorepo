"use client";

import { useState } from "react";
import { Loader2, Image as ImageIcon, Tag, Eye } from "lucide-react";

import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { PhysicalInputs } from "@/modules/portfolio/components/cast/PhysicalInputs";
import { TagSelector } from "@/modules/portfolio/components/cast/TagSelector";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";
import { ProfilePreviewModal } from "@/modules/portfolio/components/cast/ProfilePreviewModal";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { useCastData } from "@/modules/portfolio/hooks";

export default function ProfileEditPage() {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

  // Use combined hook with profile API path
  const {
    profile: profileForm,
    images,
    plans,
    schedules,
    loading,
    updateProfile,
    updateImages,
    saveProfile,
    saveImages,
    uploadImage,
  } = useCastData({ apiPath: "/api/cast/profile" });

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
      await saveImages(images);

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
        <Loader2 className="animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      <div className="px-4 py-6 space-y-6">
        {/* Top Preview Button */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 text-pink-500 font-bold bg-white border border-pink-100 px-6 py-2 rounded-full hover:bg-pink-50 transition-colors shadow-sm"
          >
            <Eye size={18} />
            <span>Preview Profile</span>
          </button>
        </div>

        {/* Sections */}

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
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs shadow-sm font-bold">
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
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-100 text-pink-500 text-xs shadow-sm font-bold">
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
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-100 text-pink-500 text-xs shadow-sm font-bold">
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
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-500 text-xs shadow-sm font-bold">
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
      </div>

      {/* Save Actions */}
      <div className="flex flex-col gap-4 px-4 pb-12 items-center">
        <ActionButton
          mode="save"
          label="Save Profile"
          onClick={handleSave}
          className="max-w-md"
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
