"use client";

import { useCallback } from "react";
import type { KarteEntry } from "../types";
import { useKarteMutation } from "./useKarteMutation";

export function useKarteLifecycle(id: string) {
  const { run, loading, error } = useKarteMutation<{ entry: KarteEntry }>();
  const close = useCallback(async (): Promise<KarteEntry> => (await run(`/api/karte/${id}/close`, { method: "POST" })).entry, [id, run]);
  const reopen = useCallback(async (): Promise<KarteEntry> => (await run(`/api/karte/${id}/reopen`, { method: "POST" })).entry, [id, run]);
  return { close, reopen, loading, error };
}
