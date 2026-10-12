"use client";

import { useCallback } from "react";
import type { KarteEntry } from "../types";
import { useKarteMutation } from "./useKarteMutation";

export function useUpdateKarte() {
  const { run, loading, error } = useKarteMutation<{ entry: KarteEntry }>();
  const update = useCallback(async (id: string, attrs: { rating?: number | null; body?: string }): Promise<KarteEntry> => {
    const response = await run(`/api/karte/${id}`, { method: "PATCH", body: attrs });
    return response.entry;
  }, [run]);
  return { update, loading, error };
}
