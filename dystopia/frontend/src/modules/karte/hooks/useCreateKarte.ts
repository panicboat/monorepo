"use client";

import { useCallback } from "react";
import type { KarteEntry, KarteEventInput } from "../types";
import { useKarteMutation } from "./useKarteMutation";

export function useCreateKarte() {
  const { run, loading, error } = useKarteMutation<{ entry: KarteEntry }>();
  const create = useCallback(async (input: { targetProfileId: string; rating: number | null; firstEvent: KarteEventInput }): Promise<KarteEntry> => {
    const response = await run("/api/karte", { method: "POST", body: input });
    return response.entry;
  }, [run]);
  return { create, loading, error };
}
