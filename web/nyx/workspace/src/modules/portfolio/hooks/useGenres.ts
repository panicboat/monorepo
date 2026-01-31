"use client";

import useSWR from "swr";
import { Genre } from "@/modules/portfolio/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseGenresResult {
  genres: Genre[];
  loading: boolean;
  error: any;
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
