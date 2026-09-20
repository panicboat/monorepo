"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useSaveSchedule() {
  return useCallback(async (workDate: string, startTime: string, endTime: string): Promise<void> => {
    await authFetch("/api/schedule/save", {
      method: "POST",
      body: { workDate, startTime, endTime },
    });
  }, []);
}
