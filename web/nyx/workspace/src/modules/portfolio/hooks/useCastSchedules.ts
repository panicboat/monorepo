"use client";

import { useState, useCallback } from "react";
import { WeeklySchedule } from "@/modules/portfolio/types";
import { mapApiToSchedules, mapSchedulesToApi } from "@/modules/portfolio/lib/cast/mappers";
import { useAuthStore } from "@/stores/authStore";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().accessToken;
};

interface UseCastSchedulesOptions {
  apiPath?: string;
  initialSchedules?: WeeklySchedule[];
}

export function useCastSchedules(options: UseCastSchedulesOptions = {}) {
  const { apiPath = "/api/cast/schedules", initialSchedules = [] } = options;

  const [schedules, setSchedules] = useState<WeeklySchedule[]>(initialSchedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSchedules = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setSchedules([]);
      return [];
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
          setSchedules([]);
          return [];
        }
        throw new Error("Failed to fetch schedules");
      }

      const data = await res.json();
      const mappedSchedules = mapApiToSchedules(data.schedules || data);
      setSchedules(mappedSchedules);
      return mappedSchedules;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  const updateSchedules = useCallback((newSchedules: WeeklySchedule[]) => {
    setSchedules(newSchedules);
  }, []);

  const saveSchedules = useCallback(
    async (overrideSchedules?: WeeklySchedule[], validPlanIds?: Set<string>) => {
      const token = getToken();
      if (!token) throw new Error("No token");

      const schedulesToSave = overrideSchedules || schedules;
      const payload = { schedules: mapSchedulesToApi(schedulesToSave, validPlanIds) };

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save schedules");
      }

      return res.json();
    },
    [apiPath, schedules]
  );

  const initializeFromApi = useCallback((apiSchedules: any[]) => {
    const mappedSchedules = mapApiToSchedules(apiSchedules);
    setSchedules(mappedSchedules);
    return mappedSchedules;
  }, []);

  return {
    schedules,
    loading,
    error,
    fetchSchedules,
    updateSchedules,
    saveSchedules,
    setSchedules,
    initializeFromApi,
  };
}
