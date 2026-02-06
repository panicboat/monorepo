"use client";

import useSWR from "swr";
import { Genre } from "@/modules/portfolio/types";
import { fetcher } from "@/lib/swr";

interface UseGenresResult {
  genres: Genre[];
  loading: boolean;
  error: Error | undefined;
}

export function useGenres(): UseGenresResult {
  const { data, error, isLoading } = useSWR<{ genres: Genre[] }>(
    "/api/guest/genres",
    fetcher
  );

  const genres = (data?.genres || []).sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    genres,
    loading: isLoading,
    error,
  };
}
