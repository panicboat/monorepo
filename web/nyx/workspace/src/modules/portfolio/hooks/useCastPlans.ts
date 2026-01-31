"use client";

import { useState, useCallback } from "react";
import { ServicePlan } from "@/modules/portfolio/types";
import { mapApiToPlans, mapPlansToApi } from "@/modules/portfolio/lib/cast/mappers";
import { getAccessToken } from "@/lib/auth";

interface UseCastPlansOptions {
  apiPath?: string;
  initialPlans?: ServicePlan[];
}

export function useCastPlans(options: UseCastPlansOptions = {}) {
  const { apiPath = "/api/cast/plans", initialPlans = [] } = options;

  const [plans, setPlans] = useState<ServicePlan[]>(initialPlans);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlans = useCallback(async () => {
    const token = getAccessToken("cast");
    if (!token) {
      setPlans([]);
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
          setPlans([]);
          return [];
        }
        throw new Error("Failed to fetch plans");
      }

      const data = await res.json();
      const mappedPlans = mapApiToPlans(data.plans || data);
      setPlans(mappedPlans);
      return mappedPlans;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  const updatePlans = useCallback((newPlans: ServicePlan[]) => {
    setPlans(newPlans);
  }, []);

  const savePlans = useCallback(
    async (overridePlans?: ServicePlan[]) => {
      const token = getAccessToken("cast");
      if (!token) throw new Error("No token");

      const plansToSave = overridePlans || plans;
      const payload = { plans: mapPlansToApi(plansToSave) };

      const res = await fetch(apiPath, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save plans");
      }

      const responseData = await res.json();
      if (responseData.plans) {
        const updatedPlans = mapApiToPlans(responseData.plans);
        setPlans(updatedPlans);
        return updatedPlans;
      }

      return plansToSave;
    },
    [apiPath, plans]
  );

  const initializeFromApi = useCallback((apiPlans: any[]) => {
    const mappedPlans = mapApiToPlans(apiPlans);
    setPlans(mappedPlans);
    return mappedPlans;
  }, []);

  return {
    plans,
    loading,
    error,
    fetchPlans,
    updatePlans,
    savePlans,
    setPlans,
    initializeFromApi,
  };
}
