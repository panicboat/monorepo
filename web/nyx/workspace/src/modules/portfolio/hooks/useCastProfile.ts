"use client";

import { useState, useEffect, useCallback } from "react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { mapApiToProfileForm, mapProfileFormToApi } from "@/modules/portfolio/lib/cast/mappers";

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

interface UseCastProfileOptions {
  apiPath?: string;
  autoFetch?: boolean;
}

export function useCastProfile(options: UseCastProfileOptions = {}) {
  const { apiPath = "/api/cast/profile", autoFetch = true } = options;

  const [profile, setProfile] = useState<ProfileFormData>(INITIAL_PROFILE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialized, setInitialized] = useState(false);

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setProfile(INITIAL_PROFILE);
      setLoading(false);
      setInitialized(true);
      return { profile: null, plans: [], schedules: [] };
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
          setLoading(false);
          setInitialized(true);
          return { profile: null, plans: [], schedules: [] };
        }
        throw new Error("Failed to fetch profile");
      }

      const data = await res.json();
      const mappedProfile = mapApiToProfileForm(data.profile);
      setProfile(mappedProfile);
      setInitialized(true);

      return {
        profile: data.profile,
        plans: data.plans || [],
        schedules: data.schedules || [],
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  const updateProfile = useCallback((updates: Partial<ProfileFormData>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveProfile = useCallback(
    async (overrideProfile?: ProfileFormData, heroKey?: string, galleryKeys?: string[]) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const profileToSave = overrideProfile || profile;
      const payload = mapProfileFormToApi(profileToSave, heroKey, galleryKeys);

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      return res.json();
    },
    [apiPath, profile]
  );

  useEffect(() => {
    if (autoFetch && !initialized) {
      fetchProfile().catch(console.error);
    }
  }, [autoFetch, initialized, fetchProfile]);

  return {
    profile,
    loading,
    error,
    initialized,
    fetchProfile,
    updateProfile,
    saveProfile,
    setProfile,
  };
}
