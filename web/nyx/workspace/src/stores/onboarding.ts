"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { ScheduleItem } from "@/modules/ritual/components/cast/WeeklyShiftInput";

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
  shifts: ScheduleItem[];

  // Meta
  loading: boolean;
  isNewProfile: boolean;
  initialized: boolean;
}

interface OnboardingActions {
  // Setters
  setProfile: (profile: Partial<ProfileFormData>) => void;
  setPhotos: (photos: Partial<OnboardingState["photos"]>) => void;
  setPlans: (plans: PlanData[]) => void;
  setShifts: (shifts: ScheduleItem[]) => void;
  setLoading: (loading: boolean) => void;
  setIsNewProfile: (isNew: boolean) => void;
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
  defaultShiftStart: "18:00",
  defaultShiftEnd: "23:00",
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
  shifts: [],
  loading: true,
  isNewProfile: false,
  initialized: false,
};

// Helper to get token
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nyx_cast_access_token");
};

// Helper to determine media type from key
const getMediaType = (key: string): "image" | "video" => {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  return ["mp4", "webm", "mov", "avi"].includes(ext) ? "video" : "image";
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

      setShifts: (shifts) => set({ shifts }),

      setLoading: (loading) => set({ loading }),

      setIsNewProfile: (isNewProfile) => set({ isNewProfile }),

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
                isNewProfile: true,
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

            const profileImage: PhotoItem | null = p.imagePath
              ? { url: `/uploads/${p.imagePath}`, key: p.imagePath, type: "image" }
              : null;

            const galleryImages: PhotoItem[] = (p.images || []).map(
              (key: string, index: number) => ({
                id: `existing-${index}`,
                url: `/uploads/${key}`,
                key: key,
                type: getMediaType(key),
              })
            );

            const socialLinks = p.socialLinks || {};

            set({
              isNewProfile: false,
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
                tags: [],
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
              shifts: schedules.map((s: any) => ({
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
        const method = state.isNewProfile ? "POST" : "PUT";

        const res = await fetch("/api/cast/onboarding/profile", {
          method,
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
            defaultShiftStart: profileToSave.defaultShiftStart,
            defaultShiftEnd: profileToSave.defaultShiftEnd,
            imagePath: state.photos.profile?.key,
            socialLinks: profileToSave.socialLinks,
          }),
        });

        if (!res.ok) throw new Error("Failed to save profile");

        if (state.isNewProfile) {
          set({ isNewProfile: false });
        }
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
        const schedulesToSave = overrideSchedules || state.shifts;
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
        shifts: state.shifts,
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
export const useOnboardingShifts = () =>
  useOnboardingStore((state) => state.shifts);
export const useOnboardingLoading = () =>
  useOnboardingStore((state) => state.loading);
