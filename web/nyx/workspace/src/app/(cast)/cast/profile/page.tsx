"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Image as ImageIcon, Tag, Eye } from "lucide-react";

import { CastProfile, ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { PhysicalInputs } from "@/modules/portfolio/components/cast/PhysicalInputs";
import { TagSelector } from "@/modules/portfolio/components/cast/TagSelector";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";
import { ProfilePreviewModal } from "./components/ProfilePreviewModal";
import { SectionCard } from "./components/SectionCard";
import { SectionNav } from "./components/SectionNav";

// Mock Toast for now if UI component missing
const useToast = () => ({
  toast: ({ title, description, variant }: any) => {
    alert(`${title}\n${description}`);
  },
});

export default function ProfileEditPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // State
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    nickname: "",
    tagline: "",
    bio: "",
    serviceCategory: "standard",
    locationType: "dispatch",
    area: "",
    defaultScheduleStart: "18:00",
    defaultScheduleEnd: "23:00",
    socialLinks: { others: [] },
    tags: [],
    age: undefined,
    height: undefined,
    bloodType: undefined,
    threeSizes: { b: 0, w: 0, h: 0, cup: "" },
  });

  const [images, setImages] = useState<MediaItem[]>([]);

  // Handlers
  const handleProfileChange = (key: keyof ProfileFormData, val: any) => {
    setProfileForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleTagsChange = (newTags: string[]) => {
    setProfileForm((prev) => ({ ...prev, tags: newTags }));
  };

  const handleSocialChange = (
    key: keyof ProfileFormData["socialLinks"],
    val: string,
  ) => {
    setProfileForm((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: val },
    }));
  };

  const handleOtherChange = (index: number, val: string) => {
    setProfileForm((prev) => {
      const newOthers = [...(prev.socialLinks.others || [])];
      newOthers[index] = val;
      return {
        ...prev,
        socialLinks: { ...prev.socialLinks, others: newOthers },
      };
    });
  };

  const handleAddOther = () => {
    setProfileForm((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: [...(prev.socialLinks.others || []), ""],
      },
    }));
  };

  const handleRemoveOther = (index: number) => {
    setProfileForm((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: (prev.socialLinks.others || []).filter((_, i) => i !== index),
      },
    }));
  };

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("nyx_cast_access_token");
        const res = await fetch("/api/cast/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data: CastProfile = await res.json();

        // Map API data to Form State
        setProfileForm({
          nickname: data.name,
          tagline: data.tagline || "",
          bio: data.bio || "",
          serviceCategory: data.serviceCategory || "standard",
          locationType: data.locationType || "dispatch",
          area: data.area || "",
          defaultScheduleStart: "18:00", // Default if missing
          defaultScheduleEnd: "23:00",
          socialLinks: {
            ...data.socialLinks,
            others: data.socialLinks?.others || [],
          },
          // New Fields
          tags: data.tags?.map((t) => t.label) || [], // CastTag[] -> string[]
          age: data.age,
          height: data.height,
          bloodType: data.bloodType,
          threeSizes: data.threeSizes || { b: 0, w: 0, h: 0, cup: "" },
        });

        // Images
        const imgList: MediaItem[] = [];
        if (data.images.hero) {
             imgList.push({ type: "image", url: data.images.hero });
        }
        if (data.images.portfolio) imgList.push(...data.images.portfolio);
        setImages(imgList);
      } catch (e) {
        console.error(e);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Image Upload Handler
  const handleUpload = async (file: File): Promise<MediaItem | null> => {
    try {
        const token = localStorage.getItem("nyx_cast_access_token");
        if (!token) throw new Error("No token");

        const res = await fetch("/api/cast/onboarding/upload-url", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ filename: file.name, contentType: file.type })
        });

        if (!res.ok) throw new Error("Failed to get URL");
        const { url, key } = await res.json();

        const uploadRes = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file
        });
        if (!uploadRes.ok) throw new Error("Upload failed");

        return {
            url: URL.createObjectURL(file),
            key: key,
            type: file.type.startsWith("video") ? "video" : "image"
        };
    } catch (e) {
        console.error(e);
        return null;
    }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("nyx_cast_access_token");
      // Payload mappings
      const payload = {
        name: profileForm.nickname,
        tagline: profileForm.tagline,
        bio: profileForm.bio,
        area: profileForm.area,
        serviceCategory: profileForm.serviceCategory,
        locationType: profileForm.locationType,
        socialLinks: profileForm.socialLinks,
        imagePath: images[0]?.key, // Send Key for Hero
        images: images.slice(1).map(i => i.url), // Send URLs for Portfolio (Legacy/Simple)

        // Metadata
        tags: profileForm.tags.map((t) => ({ label: t, count: 1 })),
        age: profileForm.age,
        height: profileForm.height,
        bloodType: profileForm.bloodType,
        threeSizes: profileForm.threeSizes,
      };

      const res = await fetch("/api/cast/profile", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token || ""}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-pink-500" />
      </div>
    );
  }

  // Time options for StyleInputs
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? "00" : "30";
    return `${h.toString().padStart(2, "0")}:${m}`;
  });

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
          <PhotoUploader images={images} onChange={setImages} onUpload={handleUpload} />
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
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex w-full max-w-md items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 ${
            saving
              ? "bg-pink-400 cursor-not-allowed"
              : "bg-pink-500 hover:bg-pink-600 shadow-pink-200 hover:shadow-pink-300"
          }`}
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          <span>{saving ? "Saving..." : "Save Profile"}</span>
        </button>
      </div>

      <ProfilePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        formData={profileForm}
        images={images}
      />
    </div>
  );
}
