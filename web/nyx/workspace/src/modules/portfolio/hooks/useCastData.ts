"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { ProfileFormData, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";
import {
  mapApiToProfileForm,
  mapProfileFormToApi,
  mapApiToImages,
  mapApiToPlans,
  mapPlansToApi,
  mapApiToSchedules,
  mapSchedulesToApi,
} from "@/modules/portfolio/lib/cast/mappers";
import { fetcher } from "@/lib/swr";

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

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nyx_cast_access_token");
};

interface UseCastDataOptions {
  apiPath?: string;
}

interface CastDataApiResponse {
  profile?: any;
  plans?: any[];
  schedules?: any[];
}

/**
 * Combined hook for managing all cast data (profile, images, plans, schedules).
 * Uses SWR for data fetching and caching.
 * Useful for onboarding flow where all data is fetched/saved together.
 */
export function useCastData(options: UseCastDataOptions = {}) {
  const { apiPath = "/api/cast/onboarding/profile" } = options;

  const token = getToken();

  // Use SWR for data fetching
  const { data, error, isLoading, mutate } = useSWR<CastDataApiResponse>(
    token ? apiPath : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onError: (err) => {
        // Handle 404 as expected state for new users
        if ((err as any).status === 404) {
          return;
        }
        console.error("Failed to load cast data", err);
      },
    }
  );

  // Derive state from API response
  const profile = useMemo(() =>
    data?.profile ? mapApiToProfileForm(data.profile) : INITIAL_PROFILE,
    [data?.profile]
  );

  const images = useMemo(() =>
    data?.profile ? mapApiToImages(data.profile) : [],
    [data?.profile]
  );

  const plans = useMemo(() =>
    mapApiToPlans(data?.plans || []),
    [data?.plans]
  );

  const schedules = useMemo(() =>
    mapApiToSchedules(data?.schedules || []),
    [data?.schedules]
  );

  // Update functions that modify local cache
  const updateProfile = useCallback(
    (updates: Partial<ProfileFormData>) => {
      mutate(
        (currentData) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            profile: {
              ...currentData.profile,
              name: updates.nickname ?? currentData.profile?.name,
              tagline: updates.tagline ?? currentData.profile?.tagline,
              bio: updates.bio ?? currentData.profile?.bio,
              area: updates.area ?? currentData.profile?.area,
              serviceCategory: updates.serviceCategory ?? currentData.profile?.serviceCategory,
              locationType: updates.locationType ?? currentData.profile?.locationType,
              socialLinks: updates.socialLinks ?? currentData.profile?.socialLinks,
              age: updates.age ?? currentData.profile?.age,
              height: updates.height ?? currentData.profile?.height,
              bloodType: updates.bloodType ?? currentData.profile?.bloodType,
              threeSizes: updates.threeSizes ?? currentData.profile?.threeSizes,
              tags: updates.tags ?? currentData.profile?.tags,
            },
          };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  const updateImages = useCallback(
    (newImages: MediaItem[]) => {
      mutate(
        (currentData) => {
          if (!currentData) return { profile: { images: { hero: newImages[0], portfolio: newImages.slice(1) } } };
          return {
            ...currentData,
            profile: {
              ...currentData.profile,
              images: {
                hero: newImages[0] || null,
                portfolio: newImages.slice(1),
              },
            },
          };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  const updatePlans = useCallback(
    (newPlans: ServicePlan[]) => {
      mutate(
        (currentData) => ({
          ...currentData,
          plans: mapPlansToApi(newPlans),
        }),
        { revalidate: false }
      );
    },
    [mutate]
  );

  const updateSchedules = useCallback(
    (newSchedules: WeeklySchedule[]) => {
      mutate(
        (currentData) => ({
          ...currentData,
          schedules: mapSchedulesToApi(newSchedules),
        }),
        { revalidate: false }
      );
    },
    [mutate]
  );

  // Save functions
  const saveProfile = useCallback(
    async (overrideProfile?: ProfileFormData) => {
      const currentToken = getToken();
      if (!currentToken) throw new Error("No token");

      const profileToSave = overrideProfile || profile;
      const heroKey = images[0]?.key;
      const payload = mapProfileFormToApi(profileToSave, heroKey);

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      mutate();
      return res.json();
    },
    [apiPath, profile, images, mutate]
  );

  const saveImages = useCallback(
    async (overrideImages?: MediaItem[]) => {
      const currentToken = getToken();
      if (!currentToken) throw new Error("No token");

      const imagesToSave = overrideImages || images;
      const heroImage = imagesToSave[0];
      const galleryImages = imagesToSave.slice(1);
      const galleryKeys = galleryImages.map((img) => img.key || img.url).filter(Boolean);

      const res = await fetch("/api/cast/onboarding/images", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          profileImagePath: heroImage?.key,
          galleryImages: galleryKeys,
        }),
      });

      if (!res.ok) throw new Error("Failed to save images");
      mutate();
      return res.json();
    },
    [images, mutate]
  );

  const savePlans = useCallback(
    async (overridePlans?: ServicePlan[]) => {
      const currentToken = getToken();
      if (!currentToken) throw new Error("No token");

      const plansToSave = overridePlans || plans;
      const payload = { plans: mapPlansToApi(plansToSave) };

      const res = await fetch("/api/cast/onboarding/plans", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save plans");

      const responseData = await res.json();
      if (responseData.plans) {
        mutate(
          (currentData) => ({
            ...currentData,
            plans: responseData.plans,
          }),
          { revalidate: false }
        );
      }
      return responseData;
    },
    [plans, mutate]
  );

  const saveSchedules = useCallback(
    async (overrideSchedules?: WeeklySchedule[]) => {
      const currentToken = getToken();
      if (!currentToken) throw new Error("No token");

      const schedulesToSave = overrideSchedules || schedules;
      const validPlanIds = new Set(plans.map((p) => p.id).filter(Boolean));
      const payload = { schedules: mapSchedulesToApi(schedulesToSave, validPlanIds) };

      const res = await fetch("/api/cast/onboarding/schedules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save schedules");
      mutate();
      return res.json();
    },
    [schedules, plans, mutate]
  );

  // Image upload
  const uploadImage = useCallback(async (file: File): Promise<{ key: string; url: string }> => {
    const currentToken = getToken();
    if (!currentToken) throw new Error("No token");

    const res = await fetch("/api/cast/onboarding/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });

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
  }, []);

  // Publish
  const publishProfile = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) throw new Error("No token");

    const res = await fetch("/api/cast/onboarding/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ status: "online" }),
    });

    if (!res.ok) throw new Error("Failed to publish profile");
    mutate();
    return res.json();
  }, [mutate]);

  // Refetch
  const fetchData = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    // Data
    profile,
    images,
    plans,
    schedules,

    // Meta
    loading: isLoading,
    initialized: !isLoading,
    error,

    // Fetch
    fetchData,

    // Update (local cache)
    updateProfile,
    updateImages,
    updatePlans,
    updateSchedules,

    // Save (to server)
    saveProfile,
    saveImages,
    savePlans,
    saveSchedules,
    uploadImage,
    publishProfile,

    // SWR mutate
    mutate,
  };
}
