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
import { fetcher, getAuthToken } from "@/lib/swr";

const INITIAL_PROFILE: ProfileFormData = {
  nickname: "",
  slug: "",
  tagline: "",
  bio: "",
  areaIds: [],
  genreIds: [],
  defaultScheduleStart: "10:00",
  defaultScheduleEnd: "22:00",
  socialLinks: { others: [] },
  tags: [],
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

  const token = getAuthToken();

  // Use SWR for data fetching
  const { data, error, isLoading, mutate } = useSWR<CastDataApiResponse>(
    token ? apiPath : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      // Disable retry for 404 (expected for new users)
      shouldRetryOnError: (err) => {
        if ((err as any).status === 404) return false;
        return true;
      },
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

  const avatarUrl = useMemo(() =>
    data?.profile?.avatarUrl || data?.profile?.imageUrl || "",
    [data?.profile]
  );

  const avatarPath = useMemo(() =>
    data?.profile?.avatarPath || "",
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

  const isPrivate = useMemo(() =>
    data?.profile?.isPrivate ?? false,
    [data?.profile]
  );

  // Update functions that modify local cache
  const updateProfile = useCallback(
    (updates: Partial<ProfileFormData>) => {
      mutate(
        (currentData) => {
          const existingProfile = currentData?.profile || {};
          return {
            ...currentData,
            profile: {
              ...existingProfile,
              name: updates.nickname ?? existingProfile.name,
              slug: updates.slug ?? existingProfile.slug,
              tagline: updates.tagline ?? existingProfile.tagline,
              bio: updates.bio ?? existingProfile.bio,
              areas: updates.areaIds
                ? updates.areaIds.map((id: string) => ({ id }))
                : existingProfile.areas,
              genres: updates.genreIds
                ? updates.genreIds.map((id: string) => ({ id }))
                : existingProfile.genres,
              defaultScheduleStart: updates.defaultScheduleStart ?? existingProfile.defaultScheduleStart,
              defaultScheduleEnd: updates.defaultScheduleEnd ?? existingProfile.defaultScheduleEnd,
              socialLinks: updates.socialLinks ?? existingProfile.socialLinks,
              age: updates.age ?? existingProfile.age,
              height: updates.height ?? existingProfile.height,
              bloodType: updates.bloodType ?? existingProfile.bloodType,
              threeSizes: updates.threeSizes ?? existingProfile.threeSizes,
              tags: updates.tags ?? existingProfile.tags,
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
      const currentToken = getAuthToken();
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
    async (overrideImages?: MediaItem[], overrideAvatarPath?: string) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error("No token");

      const imagesToSave = overrideImages || images;
      const heroImage = imagesToSave[0];
      const galleryImages = imagesToSave.slice(1);
      const galleryKeys = galleryImages.map((img) => img.key || img.url).filter(Boolean);

      const payload: Record<string, any> = {
        profileImagePath: heroImage?.key,
        galleryImages: galleryKeys,
      };
      if (overrideAvatarPath !== undefined) {
        payload.avatarPath = overrideAvatarPath;
      }

      const res = await fetch("/api/cast/onboarding/images", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save images");
      mutate();
      return res.json();
    },
    [images, mutate]
  );

  const savePlans = useCallback(
    async (overridePlans?: ServicePlan[]) => {
      const currentToken = getAuthToken();
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
      const currentToken = getAuthToken();
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
    const currentToken = getAuthToken();
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
    const currentToken = getAuthToken();
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

  // Save visibility (public/private)
  const saveVisibility = useCallback(
    async (newIsPrivate: boolean) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error("No token");

      const res = await fetch("/api/cast/visibility", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ isPrivate: newIsPrivate }),
      });

      if (!res.ok) throw new Error("Failed to save visibility");

      // Update local cache
      mutate(
        (currentData) => ({
          ...currentData,
          profile: {
            ...currentData?.profile,
            isPrivate: newIsPrivate,
          },
        }),
        { revalidate: false }
      );

      return res.json();
    },
    [mutate]
  );

  // Refetch
  const fetchData = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    // Data
    profile,
    images,
    avatarUrl,
    avatarPath,
    plans,
    schedules,
    isPrivate,

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
    saveVisibility,

    // SWR mutate
    mutate,
  };
}
