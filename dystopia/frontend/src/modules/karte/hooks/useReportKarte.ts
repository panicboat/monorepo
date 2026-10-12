"use client";

import { useCallback } from "react";
import { useKarteMutation } from "./useKarteMutation";

export function useReportKarte() {
  const { run, loading, error } = useKarteMutation<{ ok: boolean }>();
  const report = useCallback(async (id: string, reason: string): Promise<boolean> => (await run(`/api/karte/${id}/report`, { method: "POST", body: { reason } })).ok, [run]);
  return { report, loading, error };
}
