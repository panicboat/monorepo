"use client";

import { useCallback } from "react";
import { useKarteMutation } from "./useKarteMutation";

export function useDeleteKarte() {
  const { run, loading, error } = useKarteMutation<{ ok: boolean }>();
  const remove = useCallback(async (id: string): Promise<boolean> => (await run(`/api/karte/${id}`, { method: "DELETE" })).ok, [run]);
  return { remove, loading, error };
}
