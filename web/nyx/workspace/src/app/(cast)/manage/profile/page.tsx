"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Image as ImageIcon, Tag } from "lucide-react";
import Link from "next/link";

import { CastProfile, ProfileFormData } from "@/modules/portfolio/types";
import { ProfileInputs } from "@/modules/portfolio/components/cast/ProfileInputs";
import { StyleInputs } from "@/modules/portfolio/components/cast/StyleInputs";
import { SocialInputs } from "@/modules/portfolio/components/cast/SocialInputs";
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
  });

  const [images, setImages] = useState<string[]>([]);

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
      };

      const res = await fetch("/api/cast/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast({ title: "Success", description: "Profile updated successfully!" });
      router.refresh(); // logical refresh
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

        {/* Photos */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <ImageIcon size={20} className="text-pink-500" />
            Photos
          </h2>
          <PhotoUploader images={images} onChange={setImages} />
        </section>

        {/* Basic Info */}
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

        {/* Save Button */}
        <div className="pt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>Save Profile</span>
          </button>
        </div>




      </div>
    </div>
  );
}
