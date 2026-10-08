"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useRecordVisit() {
  return useCallback(async (visitedProfileId: string): Promise<void> => {
    try {
      await authFetch("/api/footprints/visit", {
        method: "POST",
        body: { visitedProfileId },
      });
    } catch {
      // SILENT: visit recording failure should not affect UX
    }
  }, []);
}
