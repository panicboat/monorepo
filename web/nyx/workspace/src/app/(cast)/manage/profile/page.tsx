"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Image as ImageIcon, Tag } from "lucide-react";
import Link from "next/link";

import { CastProfile, ProfileFormData } from "@/modules/portfolio/types";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
import { PhysicalInputs } from "@/modules/portfolio/components/cast/PhysicalInputs";
import { TagSelector } from "@/modules/portfolio/components/cast/TagSelector";
import { PhotoUploader } from "@/modules/portfolio/components/cast/PhotoUploader";




// Mock Toast for now if UI component missing
const useToast = () => ({
  toast: ({ title, description, variant }: any) => {
    alert(`${title}\n${description}`);
  }
});

export default function ProfileEditPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    nickname: "",
    tagline: "",
    bio: "",
    serviceCategory: "standard",
    locationType: "dispatch",
    area: "",
    defaultShiftStart: "18:00",
    defaultShiftEnd: "23:00",
    socialLinks: { others: [] },
    tags: [],
    age: undefined,
    height: undefined,
    bloodType: undefined,
    threeSizes: { b: 0, w: 0, h: 0, cup: "" },
  });

  const [images, setImages] = useState<string[]>([]);

  // Handlers
  const handleTagsChange = (newTags: string[]) => {
    setProfileForm(prev => ({ ...prev, tags: newTags }));
  };

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/cast/profile");
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
          defaultShiftStart: "18:00", // Default if missing
          defaultShiftEnd: "23:00",
          socialLinks: {
            ...data.socialLinks,
            others: data.socialLinks?.others || [],
          },
          // New Fields
          tags: data.tags?.map(t => t.label) || [], // CastTag[] -> string[]
          age: data.age,
          height: data.height,
          bloodType: data.bloodType,
          threeSizes: data.threeSizes || { b: 0, w: 0, h: 0, cup: "" },
        });

        // Images
        const imgList = [];
        if (data.images.hero) imgList.push(data.images.hero);
        if (data.images.portfolio) imgList.push(...data.images.portfolio);
        setImages(imgList);





      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to load profile data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handlers
  const handleProfileChange = (key: keyof ProfileFormData, val: any) => {
    setProfileForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSocialChange = (key: keyof ProfileFormData["socialLinks"], val: string) => {
    setProfileForm(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: val }
    }));
  };

  const handleOtherChange = (index: number, val: string) => {
    setProfileForm(prev => {
      const newOthers = [...(prev.socialLinks.others || [])];
      newOthers[index] = val;
      return { ...prev, socialLinks: { ...prev.socialLinks, others: newOthers } };
    });
  };

  const handleAddOther = () => {
    setProfileForm(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, others: [...(prev.socialLinks.others || []), ""] }
    }));
  };

  const handleRemoveOther = (index: number) => {
    setProfileForm(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        others: (prev.socialLinks.others || []).filter((_, i) => i !== index)
      }
    }));
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      // Map Form State back to API Payload
      const payload: Partial<CastProfile> = {
        name: profileForm.nickname,
        tagline: profileForm.tagline,
        bio: profileForm.bio,
        area: profileForm.area,
        serviceCategory: profileForm.serviceCategory,
        locationType: profileForm.locationType,
        socialLinks: profileForm.socialLinks,
        images: {
          hero: images[0] || "",
          portfolio: images.slice(1),
        },
        // New Fields
        tags: profileForm.tags.map(t => ({ label: t, count: 1 })), // string[] -> CastTag[]
        age: profileForm.age,
        height: profileForm.height,
        bloodType: profileForm.bloodType,
        threeSizes: profileForm.threeSizes,
      };

      const res = await fetch("/api/cast/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Success
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
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
    <div className="pb-12">
      {/* Header handled by CastTopNavBar */}



      <div className="px-4 py-6 space-y-8">
        {/* Sections */}

        {/* Photos (Order 1) */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <ImageIcon size={20} className="text-pink-500" />
            Photos
          </h2>
          <PhotoUploader images={images} onChange={setImages} />
        </section>

        {/* Basic Info (Order 2) */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Tag size={20} className="text-pink-500" />
            Basic Info
          </h2>
          <div className="space-y-6">
            <StyleInputs data={profileForm} onChange={handleProfileChange} timeOptions={timeOptions} />
            <ProfileInputs data={profileForm} onChange={handleProfileChange} />
            <SocialInputs
              data={profileForm}
              onSocialChange={handleSocialChange}
              onOtherChange={handleOtherChange}
              onAddOther={handleAddOther}
              onRemoveOther={handleRemoveOther}
            />
          </div>
        </section>

        {/* Physical Info (Order 3 - New) */}
        <section className="space-y-4 border-t border-slate-100 pt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-100 text-pink-500 text-xs shadow-sm">P</span>
            Physical Info
          </h2>
          <PhysicalInputs data={profileForm} onChange={handleProfileChange} />
        </section>

        {/* Appeal / Tags (Order 4 - New) */}
        <section className="space-y-4 border-t border-slate-100 pt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-100 text-pink-500 text-xs shadow-sm">#</span>
            Tags
          </h2>
          <TagSelector tags={profileForm.tags} onChange={handleTagsChange} />
        </section>

        {/* Save Button */}
        <div className="pt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${saving ? "bg-pink-400 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-600 shadow-pink-200 hover:shadow-pink-300"
              }`}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{saving ? "Saving..." : "Save Profile"}</span>
          </button>
        </div>




      </div>
    </div>
  );
}
