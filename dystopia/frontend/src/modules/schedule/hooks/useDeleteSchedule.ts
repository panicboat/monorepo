"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useDeleteSchedule() {
  return useCallback(async (workDate: string): Promise<void> => {
    await authFetch("/api/schedule/delete", {
      method: "POST",
      body: { workDate },
    });
  }, []);
}
