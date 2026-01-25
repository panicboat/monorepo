"use client";

import { useEffect } from "react";
import { Loader2, Image as ImageIcon, Tag, Eye } from "lucide-react";

import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { PhysicalInputs } from "@/modules/portfolio/components/cast/PhysicalInputs";
import { TagSelector } from "@/modules/portfolio/components/cast/TagSelector";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";
import { ProfilePreviewModal } from "./components/ProfilePreviewModal";
import { SectionCard } from "./components/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { useCastProfile, useCastImages, useCastPlans, useCastSchedules } from "@/modules/portfolio/hooks";
import { useState } from "react";

export default function ProfileEditPage() {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

  // Use unified hooks
  const {
    profile: profileForm,
    loading: profileLoading,
    initialized,
    fetchProfile,
    updateProfile,
    saveProfile,
  } = useCastProfile({ apiPath: "/api/cast/profile" });

  const {
    images,
    uploadImage,
    updateImages,
  } = useCastImages();

  const { plans, initializeFromApi: initializePlans } = useCastPlans();
  const { schedules, initializeFromApi: initializeSchedules } = useCastSchedules();

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!initialized) {
        const result = await fetchProfile();
        if (result) {
          // Initialize images from profile
          if (result.profile?.images) {
            const imgList: MediaItem[] = [];
            if (result.profile.images.hero && typeof result.profile.images.hero === "object") {
              imgList.push(result.profile.images.hero as MediaItem);
            }
            if (result.profile.images.portfolio) {
              imgList.push(...result.profile.images.portfolio);
            }
            updateImages(imgList);
          }
          // Initialize plans and schedules
          if (result.plans) initializePlans(result.plans);
          if (result.schedules) initializeSchedules(result.schedules);
        }
      }
    };
    loadData();
  }, [initialized, fetchProfile, updateImages, initializePlans, initializeSchedules]);

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
    const result = await uploadImage(file);
    return result;
  };

  // Save
  const handleSave = async () => {
    try {
      const heroKey = images[0]?.key;
      const galleryKeys = images.slice(1).map(i => i.key || i.url).filter(Boolean);
      await saveProfile(profileForm, heroKey, galleryKeys);

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

  if (profileLoading) {
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
