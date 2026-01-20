"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { SchedulePlan } from "@/modules/ritual/components/cast/WeeklyShiftInput";
import { ScheduleItem } from "@/modules/ritual/components/cast/WeeklyShiftInput";

// Extend with mock ID for Plans
export interface PlanData extends SchedulePlan {
  price: number;
  duration: number; // minutes
}

export type PhotoItem = {
  id?: string;
  url: string;
  key?: string; // S3 Key for saving
  type: "image" | "video";
};

export type OnboardingData = {
  profile: ProfileFormData;
  photos: {
    cover: string | null;
    profile: PhotoItem | null; // Changed from string
    gallery: PhotoItem[];
  };
  plans: PlanData[];
  shifts: ScheduleItem[];
};

const INITIAL_DATA: OnboardingData = {
  profile: {
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
  },
  photos: {
    cover: null,
    profile: null,
    gallery: [],
  },
  plans: [],
  shifts: [],
};

type OnboardingContextType = {
  data: OnboardingData;
  updateProfile: (data: Partial<ProfileFormData>) => void;
  updatePhotos: (data: Partial<OnboardingData["photos"]>) => void;
  setPlans: (plans: PlanData[]) => void;
  setShifts: (shifts: ScheduleItem[]) => void;
  save: () => Promise<void>;
  uploadImage: (file: File) => Promise<{ key: string; url: string }>;
  loading: boolean;
  isNewProfile: boolean;
  saveProfile: (data?: ProfileFormData) => Promise<void>;
  saveImages: (gallery?: PhotoItem[]) => Promise<void>;
  savePlans: (plans?: PlanData[]) => Promise<void>;
  saveSchedules: (schedules?: ScheduleItem[]) => Promise<void>;
  publishProfile: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  // Split state for granular management
  // const [formData, setFormData] = useState<ProfileFormData>(INITIAL_DATA.profile);
  // const [images, setImages] = useState<PhotoItem[]>([]);
  // We need to distinguish between profile image and gallery.
  // The UI probably expects separated, but my previous edit merged them into `images`.
  // Let's look at `OnboardingData["photos"]`. It has cover, profile, gallery.
  // Let's keep `photos` state to match original structure but update it granularly?
  // Or stick to new structure?
  // The Step 2 page uses `updatePhotos` which expects `Partial<OnboardingData["photos"]>`.
  // To minimize friction with pages, let's keep `data` state but adding `isNewProfile`.

  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [isNewProfile, setIsNewProfile] = useState(false);

  // Load from Backend via API
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("nyx_cast_access_token");
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/cast/onboarding/profile", {
          headers: { "Authorization": `Bearer ${token}` },
          cache: "no-store"
        });

        if (!res.ok) {
          if (res.status === 404) {
             setIsNewProfile(true);
             setLoading(false);
             return;
          }
          // throw new Error("Failed to fetch profile");
          // Just log and allow editing?
          console.error("Failed to fetch profile");
        } else {
          const apiData = await res.json();
          if (apiData.profile) {
             setIsNewProfile(false);
             const p = apiData.profile;
             const plans = apiData.plans || [];
             const schedules = apiData.schedules || [];

             const getMediaType = (key: string): "image" | "video" => {
               const ext = key.split('.').pop()?.toLowerCase() || '';
               return ['mp4', 'webm', 'mov', 'avi'].includes(ext) ? 'video' : 'image';
             };

             const profileImage: PhotoItem | null = p.imagePath ? { url: `/uploads/${p.imagePath}`, key: p.imagePath, type: "image" } : null;
             const galleryImages: PhotoItem[] = (p.images || []).map((key: string, index: number) => ({
                 id: `existing-${index}`,
                 url: `/uploads/${key}`,
                 key: key,
                 type: getMediaType(key)
             }));

             const socialLinks = p.socialLinks || {};
             setData(prev => ({
                ...prev,
                profile: {
                     nickname: p.name || "",
                     tagline: p.tagline || "",
                     bio: p.bio || "",
                     serviceCategory: p.serviceCategory || "standard",
                     locationType: p.locationType || "dispatch",
                     area: p.area || "",
                     defaultShiftStart: p.defaultShiftStart || "18:00",
                     defaultShiftEnd: p.defaultShiftEnd || "23:00",
                     socialLinks: {
                       x: socialLinks.x || "",
                       instagram: socialLinks.instagram || "",
                       tiktok: socialLinks.tiktok || "",
                       cityheaven: socialLinks.cityheaven || "",
                       litlink: socialLinks.litlink || "",
                       others: socialLinks.others || [],
                     },
                     tags: []
                 },
                 photos: {
                     cover: null,
                     profile: profileImage,
                     gallery: galleryImages
                 },
                 plans: plans.map((pl: any) => ({
                     id: pl.id,
                     name: pl.name,
                     price: pl.price,
                     duration: pl.durationMinutes
                 })),
                 shifts: schedules.map((s: any) => ({
                     date: s.date,
                     start: s.startTime,
                     end: s.endTime,
                     planId: s.planId
                 }))
              }));
           }
         }
       } catch (e) {
         console.error("Failed to load onboarding data", e);
       } finally {
         setLoading(false);
       }
     };
     fetchData();
   }, []);

  const uploadImage = async (file: File): Promise<{ key: string; url: string }> => {
     const token = localStorage.getItem("nyx_cast_access_token");
     if (!token) throw new Error("No token");

     // 1. Get URL
     const filename = encodeURIComponent(file.name);
     const contentType = encodeURIComponent(file.type);
     const res = await fetch(`/api/cast/onboarding/upload-url?filename=${filename}&contentType=${contentType}`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${token}`
       },
       body: JSON.stringify({ filename: file.name, contentType: file.type })
     });

     if (!res.ok) {
       const err = await res.json();
       throw new Error(err.error || "Failed to get upload URL");
     }

     const { url, key } = await res.json();

     // 2. Upload
     const uploadRes = await fetch(url, {
       method: "PUT",
       headers: { "Content-Type": file.type },
       body: file
     });

     if (!uploadRes.ok) throw new Error("Failed to upload image");

     return { key, url: url.split("?")[0] };
  };

  const updateProfile = (profileData: Partial<ProfileFormData>) => {
    setData((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...profileData },
    }));
  };

  const updatePhotos = (photosData: Partial<OnboardingData["photos"]>) => {
    setData((prev) => ({
      ...prev,
      photos: { ...prev.photos, ...photosData },
    }));
  };

  const setPlans = (plans: PlanData[]) => {
    setData((prev) => ({ ...prev, plans }));
  };

  const setShifts = (shifts: ScheduleItem[]) => {
    setData((prev) => ({ ...prev, shifts }));
  };

   // Granular Save Functions
   const saveProfile = async (overrideData?: ProfileFormData) => {
     const token = localStorage.getItem("nyx_cast_access_token");
     if (!token) return;

     // Use override data if provided, otherwise fallback to current state (which might be stale if called immediately after update)
     const profileToSave = overrideData || data.profile;

     const method = isNewProfile ? "POST" : "PUT";
     const res = await fetch("/api/cast/onboarding/profile", {
       method,
       headers: {
           "Content-Type": "application/json",
           "Authorization": `Bearer ${token}`
       },
       body: JSON.stringify({
         name: profileToSave.nickname,
         bio: profileToSave.bio,
         tagline: profileToSave.tagline,
         serviceCategory: profileToSave.serviceCategory,
         locationType: profileToSave.locationType,
         area: profileToSave.area,
         defaultShiftStart: profileToSave.defaultShiftStart,
         defaultShiftEnd: profileToSave.defaultShiftEnd,
         imagePath: data.photos.profile?.key,
         socialLinks: profileToSave.socialLinks,
       }),
     });
    if (!res.ok) throw new Error("Failed to save profile");

    if (isNewProfile) setIsNewProfile(false);
  };

  const saveImages = async (overrideGallery?: PhotoItem[]) => {
    const token = localStorage.getItem("nyx_cast_access_token");
    if (!token) return;

    // Use override data if provided, otherwise fallback to current state
    const galleryToSave = overrideGallery || data.photos.gallery;
    const galleryKeys = galleryToSave.map(img => img.key || img.url).filter(Boolean);

    const res = await fetch("/api/cast/onboarding/images", {
      method: "PUT",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        profileImagePath: data.photos.profile?.key,
        galleryImages: galleryKeys,
      }),
    });
    if (!res.ok) throw new Error("Failed to save images");
  };

  const savePlans = async (overridePlans?: PlanData[]) => {
    const token = localStorage.getItem("nyx_cast_access_token");
    if (!token) return;

    // Use override data if provided, otherwise fallback to current state
    const plansToSave = overridePlans || data.plans;

    const res = await fetch("/api/cast/onboarding/plans", {
      method: "PUT",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
          plans: plansToSave.map(p => ({
            name: p.name,
            price: p.price,
            durationMinutes: p.duration
          }))
      }),
    });
    if (!res.ok) throw new Error("Failed to save plans");

    // Update context with real IDs from backend
    const responseData = await res.json();
    if (responseData.plans) {
      const updatedPlans: PlanData[] = responseData.plans.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration: p.durationMinutes
      }));
      setData(prev => ({ ...prev, plans: updatedPlans }));
    }
  };

  const saveSchedules = async (overrideSchedules?: ScheduleItem[]) => {
    const token = localStorage.getItem("nyx_cast_access_token");
    if (!token) return;

    // Use override data if provided, otherwise fallback to current state
    const schedulesToSave = overrideSchedules || data.shifts;

    // Get valid plan IDs from context
    const validPlanIds = new Set(data.plans.map(p => p.id));

    const res = await fetch("/api/cast/onboarding/schedules", {
      method: "PUT",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
          schedules: schedulesToSave.map(s => {
            // Only include planId if it exists in current plans
            const planId = s.planId && validPlanIds.has(s.planId) ? s.planId : undefined;
            return {
              date: s.date,
              startTime: s.start,
              endTime: s.end,
              planId
            };
          })
      }),
    });
    if (!res.ok) throw new Error("Failed to save schedules");
  };

  const publishProfile = async () => {
    const token = localStorage.getItem("nyx_cast_access_token");
    if (!token) return;

    const res = await fetch("/api/cast/onboarding/publish", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ status: "online" }),
    });
    if (!res.ok) throw new Error("Failed to publish profile");
  };

  // Provide legacy deprecated 'save' that does nothing or warns, to avoid breaking pages immediately
  const save = async () => {
      console.warn("Deprecated 'save' called. Please use granular save functions.");
  };

  return (
    <OnboardingContext.Provider
      value={{
          data,
          updateProfile,
          updatePhotos,
          setPlans,
          setShifts,
          save,
          uploadImage,
          loading,
          isNewProfile,
          saveProfile,
          saveImages,
          savePlans,
          saveSchedules,
          publishProfile
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
