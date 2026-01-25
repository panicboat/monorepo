"use client";

import { useState, useEffect, useCallback } from "react";
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
  autoFetch?: boolean;
}

/**
 * Combined hook for managing all cast data (profile, images, plans, schedules).
 * Useful for onboarding flow where all data is fetched/saved together.
 */
export function useCastData(options: UseCastDataOptions = {}) {
  const { apiPath = "/api/cast/onboarding/profile", autoFetch = true } = options;

  // State
  const [profile, setProfile] = useState<ProfileFormData>(INITIAL_PROFILE);
  const [images, setImages] = useState<MediaItem[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);

  // Meta
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setProfile(INITIAL_PROFILE);
      setImages([]);
      setPlans([]);
      setSchedules([]);
      setLoading(false);
      setInitialized(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 404) {
          setProfile(INITIAL_PROFILE);
          setImages([]);
          setPlans([]);
          setSchedules([]);
          setLoading(false);
          setInitialized(true);
          return;
        }
        throw new Error("Failed to fetch data");
      }

      const apiData = await res.json();

      if (apiData.profile) {
        setProfile(mapApiToProfileForm(apiData.profile));
        setImages(mapApiToImages(apiData.profile));
      }

      setPlans(mapApiToPlans(apiData.plans || []));
      setSchedules(mapApiToSchedules(apiData.schedules || []));
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      console.error("Failed to load cast data", e);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [apiPath]);

  // Update functions
  const updateProfile = useCallback((updates: Partial<ProfileFormData>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateImages = useCallback((newImages: MediaItem[]) => {
    setImages(newImages);
  }, []);

  const updatePlans = useCallback((newPlans: ServicePlan[]) => {
    setPlans(newPlans);
  }, []);

  const updateSchedules = useCallback((newSchedules: WeeklySchedule[]) => {
    setSchedules(newSchedules);
  }, []);

  // Save functions
  const saveProfile = useCallback(
    async (overrideProfile?: ProfileFormData) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const profileToSave = overrideProfile || profile;
      const heroKey = images[0]?.key;
      const payload = mapProfileFormToApi(profileToSave, heroKey);

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      return res.json();
    },
    [apiPath, profile, images]
  );

  const saveImages = useCallback(
    async (overrideImages?: MediaItem[]) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const imagesToSave = overrideImages || images;
      const heroImage = imagesToSave[0];
      const galleryImages = imagesToSave.slice(1);
      const galleryKeys = galleryImages.map((img) => img.key || img.url).filter(Boolean);

      const res = await fetch("/api/cast/onboarding/images", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileImagePath: heroImage?.key,
          galleryImages: galleryKeys,
        }),
      });

      if (!res.ok) throw new Error("Failed to save images");
      return res.json();
    },
    [images]
  );

  const savePlans = useCallback(
    async (overridePlans?: ServicePlan[]) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const plansToSave = overridePlans || plans;
      const payload = { plans: mapPlansToApi(plansToSave) };

      const res = await fetch("/api/cast/onboarding/plans", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save plans");

      const responseData = await res.json();
      if (responseData.plans) {
        const updatedPlans = mapApiToPlans(responseData.plans);
        setPlans(updatedPlans);
        return updatedPlans;
      }
      return plansToSave;
    },
    [plans]
  );

  const saveSchedules = useCallback(
    async (overrideSchedules?: WeeklySchedule[]) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const schedulesToSave = overrideSchedules || schedules;
      const validPlanIds = new Set(plans.map((p) => p.id).filter(Boolean));
      const payload = { schedules: mapSchedulesToApi(schedulesToSave, validPlanIds) };

      const res = await fetch("/api/cast/onboarding/schedules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save schedules");
      return res.json();
    },
    [schedules, plans]
  );

  // Image upload
  const uploadImage = useCallback(async (file: File): Promise<{ key: string; url: string }> => {
    const token = getToken();
    if (!token) throw new Error("No token");

    const res = await fetch("/api/cast/onboarding/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
    const token = getToken();
    if (!token) throw new Error("No token");

    const res = await fetch("/api/cast/onboarding/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "online" }),
    });

    if (!res.ok) throw new Error("Failed to publish profile");
    return res.json();
  }, []);

  // Reset
  const reset = useCallback(() => {
    setProfile(INITIAL_PROFILE);
    setImages([]);
    setPlans([]);
    setSchedules([]);
    setInitialized(false);
  }, []);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch && !initialized) {
      fetchData();
    }
  }, [autoFetch, initialized, fetchData]);

  return {
    // Data
    profile,
    images,
    plans,
    schedules,

    // Meta
    loading,
    initialized,
    error,

    // Fetch
    fetchData,

    // Update
    updateProfile,
    updateImages,
    updatePlans,
    updateSchedules,
    setProfile,
    setImages,
    setPlans,
    setSchedules,

    // Save
    saveProfile,
    saveImages,
    savePlans,
    saveSchedules,
    uploadImage,
    publishProfile,

    // Reset
    reset,
  };
}
