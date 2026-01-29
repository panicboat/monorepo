"use client";

import useSWR from "swr";
import { Area } from "@/modules/portfolio/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseAreasResult {
  areas: Area[];
  areasByPrefecture: Map<string, Area[]>;
  prefectures: string[];
  loading: boolean;
  error: any;
}

export function useAreas(): UseAreasResult {
  const { data, error, isLoading } = useSWR<{ areas: Area[] }>("/api/areas", fetcher);

  const areas = data?.areas || [];

  // Group areas by prefecture
  const areasByPrefecture = new Map<string, Area[]>();
  for (const area of areas) {
    const existing = areasByPrefecture.get(area.prefecture) || [];
    existing.push(area);
    areasByPrefecture.set(area.prefecture, existing);
  }

  // Get unique prefectures in order
  const prefectures = Array.from(areasByPrefecture.keys());

  return {
    areas,
    areasByPrefecture,
    prefectures,
    loading: isLoading,
    error,
  };
}
