"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { ScheduleAnnouncement } from "@/modules/schedule/types";

export function useSaveSchedule() {
  return useCallback(
    async (workDate: string, startTime: string, endTime: string, announcement: ScheduleAnnouncement): Promise<void> => {
      await authFetch("/api/schedule/save", {
        method: "POST",
        body: { workDate, startTime, endTime, ...announcement },
      });
    },
    []
  );
}
