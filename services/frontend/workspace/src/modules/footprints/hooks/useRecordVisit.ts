"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useRecordVisit() {
  return useCallback(async (visitedAccountId: string): Promise<void> => {
    try {
      await authFetch("/api/footprints/visit", {
        method: "POST",
        body: { visitedAccountId },
      });
    } catch {
      // SILENT: visit recording failure should not affect UX
    }
  }, []);
}
