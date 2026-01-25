"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { ScheduleItem } from "@/modules/ritual/components/cast/WeeklyScheduleInput";
import { getMediaType } from "@/lib/media";

// Types
export interface PlanData {
  id: string;
  name: string;
  price: number;
  duration: number; // minutes
}

export type PhotoItem = {
  id?: string;
  url: string;
  key?: string; // S3 Key for saving
  type: "image" | "video";
};

export interface OnboardingState {
  // Data
  profile: ProfileFormData;
  photos: {
    cover: string | null;
    profile: PhotoItem | null;
    gallery: PhotoItem[];
  };
  plans: PlanData[];
  schedules: ScheduleItem[];

  // Meta
  loading: boolean;
  initialized: boolean;
}

interface OnboardingActions {
  // Setters
  setProfile: (profile: Partial<ProfileFormData>) => void;
  setPhotos: (photos: Partial<OnboardingState["photos"]>) => void;
  setPlans: (plans: PlanData[]) => void;
  setSchedules: (schedules: ScheduleItem[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // API Actions
  fetchProfile: () => Promise<void>;
  uploadImage: (file: File) => Promise<{ key: string; url: string }>;
  saveProfile: (data?: ProfileFormData) => Promise<void>;
  saveImages: (gallery?: PhotoItem[]) => Promise<void>;
  savePlans: (plans?: PlanData[]) => Promise<void>;
  saveSchedules: (schedules?: ScheduleItem[]) => Promise<void>;
  publishProfile: () => Promise<void>;

  // Reset
  reset: () => void;
}

const INITIAL_PROFILE: ProfileFormData = {
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
};

const INITIAL_STATE: OnboardingState = {
  profile: INITIAL_PROFILE,
  photos: {
    cover: null,
    profile: null,
    gallery: [],
  },
  plans: [],
  schedules: [],
  loading: true,
  initialized: false,
};

// Helper to get token
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nyx_cast_access_token");
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // Setters
      setProfile: (profile) =>
        set((state) => ({
          profile: { ...state.profile, ...profile },
        })),

      setPhotos: (photos) =>
        set((state) => ({
          photos: { ...state.photos, ...photos },
        })),

      setPlans: (plans) => set({ plans }),

      setSchedules: (schedules) => set({ schedules }),

      setLoading: (loading) => set({ loading }),

      setInitialized: (initialized) => set({ initialized }),

      // API Actions
      fetchProfile: async () => {
        const token = getToken();
        if (!token) {
          // No token - reset to initial state
          set({ ...INITIAL_STATE, loading: false, initialized: true });
          return;
        }

        set({ loading: true });
        try {
          const res = await fetch("/api/cast/onboarding/profile", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });

          if (!res.ok) {
            if (res.status === 404) {
              // New user - reset all data to initial state
              set({
                ...INITIAL_STATE,
                loading: false,
                initialized: true,
              });
              return;
            }
            console.error("Failed to fetch profile");
            set({ loading: false, initialized: true });
            return;
          }

          const apiData = await res.json();
          if (apiData.profile) {
            const p = apiData.profile;
            const plans = apiData.plans || [];
            const schedules = apiData.schedules || [];

            // Handle profile image from hero or imagePath
            const heroImage = p.images?.hero;
            const profileImage: PhotoItem | null = heroImage
              ? { id: heroImage.id, url: heroImage.url, key: heroImage.key, type: heroImage.type || "image" }
              : p.imagePath
                ? { url: `/uploads/${p.imagePath}`, key: p.imagePath, type: "image" }
                : null;

            // Handle gallery images from portfolio array
            const portfolioImages = p.images?.portfolio || [];
            const galleryImages: PhotoItem[] = portfolioImages.map(
              (item: { id?: string; url: string; key?: string; type?: string }, index: number) => ({
                id: item.id || `existing-${index}`,
                url: item.url,
                key: item.key || "",
                type: item.type || "image",
              })
            );

            const socialLinks = p.socialLinks || {};

            set({
              profile: {
                nickname: p.name || "",
                tagline: p.tagline || "",
                bio: p.bio || "",
                serviceCategory: p.serviceCategory || "standard",
                locationType: p.locationType || "dispatch",
                area: p.area || "",
                defaultScheduleStart: p.defaultScheduleStart || "18:00",
                defaultScheduleEnd: p.defaultScheduleEnd || "23:00",
                socialLinks: {
                  x: socialLinks.x || "",
                  instagram: socialLinks.instagram || "",
                  tiktok: socialLinks.tiktok || "",
                  cityheaven: socialLinks.cityheaven || "",
                  litlink: socialLinks.litlink || "",
                  others: socialLinks.others || [],
                },
                age: p.age || undefined,
                height: p.height || undefined,
                bloodType: p.bloodType || undefined,
                threeSizes: p.threeSizes
                  ? {
                      b: p.threeSizes.b || p.threeSizes.bust || 0,
                      w: p.threeSizes.w || p.threeSizes.waist || 0,
                      h: p.threeSizes.h || p.threeSizes.hip || 0,
                      cup: p.threeSizes.cup || "",
                    }
                  : undefined,
                tags: p.tags || [],
              },
              photos: {
                cover: null,
                profile: profileImage,
                gallery: galleryImages,
              },
              plans: plans.map((pl: any) => ({
                id: pl.id,
                name: pl.name,
                price: pl.price,
                duration: pl.durationMinutes,
              })),
              schedules: schedules.map((s: any) => ({
                date: s.date,
                start: s.startTime,
                end: s.endTime,
                planId: s.planId,
              })),
            });
          }
        } catch (e) {
          console.error("Failed to load onboarding data", e);
        } finally {
          set({ loading: false, initialized: true });
        }
      },

      uploadImage: async (file: File) => {
        const token = getToken();
        if (!token) throw new Error("No token");

        const filename = encodeURIComponent(file.name);
        const contentType = encodeURIComponent(file.type);
        const res = await fetch(
          `/api/cast/onboarding/upload-url?filename=${filename}&contentType=${contentType}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ filename: file.name, contentType: file.type }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get upload URL");
        }

        const { url, key } = await res.json();

        const uploadRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image");

        return { key, url: url.split("?")[0] };
      },

      saveProfile: async (overrideData?: ProfileFormData) => {
        const token = getToken();
        if (!token) return;

        const state = get();
        const profileToSave = overrideData || state.profile;

        const res = await fetch("/api/cast/onboarding/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: profileToSave.nickname,
            bio: profileToSave.bio,
            tagline: profileToSave.tagline,
            serviceCategory: profileToSave.serviceCategory,
            locationType: profileToSave.locationType,
            area: profileToSave.area,
            defaultScheduleStart: profileToSave.defaultScheduleStart,
            defaultScheduleEnd: profileToSave.defaultScheduleEnd,
            imagePath: state.photos.profile?.key,
            socialLinks: profileToSave.socialLinks,
            age: profileToSave.age || undefined,
            height: profileToSave.height || undefined,
            bloodType: profileToSave.bloodType || undefined,
            threeSizes: profileToSave.threeSizes
              ? {
                  bust: profileToSave.threeSizes.b,
                  waist: profileToSave.threeSizes.w,
                  hip: profileToSave.threeSizes.h,
                  cup: profileToSave.threeSizes.cup,
                }
              : undefined,
            tags: profileToSave.tags,
          }),
        });

        if (!res.ok) throw new Error("Failed to save profile");
      },

      saveImages: async (overrideGallery?: PhotoItem[]) => {
        const token = getToken();
        if (!token) return;

        const state = get();
        const galleryToSave = overrideGallery || state.photos.gallery;
        const galleryKeys = galleryToSave
          .map((img) => img.key || img.url)
          .filter(Boolean);

        const res = await fetch("/api/cast/onboarding/images", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            profileImagePath: state.photos.profile?.key,
            galleryImages: galleryKeys,
          }),
        });

        if (!res.ok) throw new Error("Failed to save images");
      },

      savePlans: async (overridePlans?: PlanData[]) => {
        const token = getToken();
        if (!token) return;

        const state = get();
        const plansToSave = overridePlans || state.plans;

        const res = await fetch("/api/cast/onboarding/plans", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            plans: plansToSave.map((p) => ({
              name: p.name,
              price: p.price,
              durationMinutes: p.duration,
            })),
          }),
        });

        if (!res.ok) throw new Error("Failed to save plans");

        const responseData = await res.json();
        if (responseData.plans) {
          const updatedPlans: PlanData[] = responseData.plans.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            duration: p.durationMinutes,
          }));
          set({ plans: updatedPlans });
        }
      },

      saveSchedules: async (overrideSchedules?: ScheduleItem[]) => {
        const token = getToken();
        if (!token) return;

        const state = get();
        const schedulesToSave = overrideSchedules || state.schedules;
        const validPlanIds = new Set(state.plans.map((p) => p.id));

        const res = await fetch("/api/cast/onboarding/schedules", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            schedules: schedulesToSave.map((s) => {
              const planId =
                s.planId && validPlanIds.has(s.planId) ? s.planId : undefined;
              return {
                date: s.date,
                startTime: s.start,
                endTime: s.end,
                planId,
              };
            }),
          }),
        });

        if (!res.ok) throw new Error("Failed to save schedules");
      },

      publishProfile: async () => {
        const token = getToken();
        if (!token) return;

        const res = await fetch("/api/cast/onboarding/publish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "online" }),
        });

        if (!res.ok) throw new Error("Failed to publish profile");
      },

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: "nyx-onboarding",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Only persist data, not meta state
        profile: state.profile,
        photos: state.photos,
        plans: state.plans,
        schedules: state.schedules,
      }),
    }
  )
);

// Selector hooks for convenience
export const useOnboardingProfile = () =>
  useOnboardingStore((state) => state.profile);
export const useOnboardingPhotos = () =>
  useOnboardingStore((state) => state.photos);
export const useOnboardingPlans = () =>
  useOnboardingStore((state) => state.plans);
export const useOnboardingSchedules = () =>
  useOnboardingStore((state) => state.schedules);
export const useOnboardingLoading = () =>
  useOnboardingStore((state) => state.loading);
