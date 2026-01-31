"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { ProfileFormData } from "@/modules/portfolio/types";
import { mapApiToProfileForm, mapProfileFormToApi } from "@/modules/portfolio/lib/cast/mappers";
import { fetcher } from "@/lib/swr";
import { getAccessToken } from "@/lib/auth";

const INITIAL_PROFILE: ProfileFormData = {
  nickname: "",
  handle: "",
  tagline: "",
  bio: "",
  areaIds: [],
  defaultScheduleStart: "10:00",
  defaultScheduleEnd: "22:00",
  socialLinks: { others: [] },
  tags: [],
};

interface UseCastProfileOptions {
  apiPath?: string;
}

interface ProfileApiResponse {
  profile: any;
  plans?: any[];
  schedules?: any[];
}

export function useCastProfile(options: UseCastProfileOptions = {}) {
  const { apiPath = "/api/cast/profile" } = options;

  const token = getAccessToken("cast");

  // Use SWR for data fetching with conditional fetching (only if token exists)
  const { data, error, isLoading, isValidating, mutate } = useSWR<ProfileApiResponse>(
    token ? apiPath : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Derive profile from API response
  const profile = data?.profile ? mapApiToProfileForm(data.profile) : INITIAL_PROFILE;

  const updateProfile = useCallback(
    (updates: Partial<ProfileFormData>) => {
      if (!data) return;

      // Optimistically update the local cache
      mutate(
        {
          ...data,
          profile: {
            ...data.profile,
            // Map updates back to API format for cache consistency
            name: updates.nickname ?? data.profile.name,
            tagline: updates.tagline ?? data.profile.tagline,
            bio: updates.bio ?? data.profile.bio,
            socialLinks: updates.socialLinks ?? data.profile.socialLinks,
            age: updates.age ?? data.profile.age,
            height: updates.height ?? data.profile.height,
            bloodType: updates.bloodType ?? data.profile.bloodType,
            threeSizes: updates.threeSizes ?? data.profile.threeSizes,
            tags: updates.tags ?? data.profile.tags,
          },
        },
        { revalidate: false }
      );
    },
    [data, mutate]
  );

  const saveProfile = useCallback(
    async (overrideProfile?: ProfileFormData, heroKey?: string, galleryKeys?: string[]) => {
      const currentToken = getAccessToken("cast");
      if (!currentToken) throw new Error("No token");

      const profileToSave = overrideProfile || profile;
      const payload = mapProfileFormToApi(profileToSave, heroKey, galleryKeys);

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      // Revalidate after save
      mutate();

      return res.json();
    },
    [apiPath, profile, mutate]
  );

  const refetch = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    profile,
    rawData: data,
    loading: isLoading,
    validating: isValidating,
    error,
    initialized: !isLoading && !error,
    fetchProfile: refetch,
    updateProfile,
    saveProfile,
    mutate,
  };
}
